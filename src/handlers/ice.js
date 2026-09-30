import {swapHandler} from "./xyk.js";
import {window} from "./dca.js";
import {api} from "../api.js";
import {BN} from "@polkadot/util";

// ICE settles intents in unsigned ice.submit_solution extrinsics. Partially
// fillable limit orders can take a tiny fill every block, so fills are batched
// per intent the same way DCA trades are: one "split over N swaps" line per
// `window` blocks, flushed early when the intent resolves, cancels or expires.
export default function iceHandler(events) {
  events
    .on('intent', 'IntentResovedPartially', fillHandler)
    .on('intent', 'DcaTradeExecuted', fillHandler)
    .on('intent', 'IntentResolved', resolvedHandler)
    .on('intent', 'IntentCanceled', closedHandler)
    .on('intent', 'IntentExpired', closedHandler)
    .on('intent', 'DcaCompleted', closedHandler)
    .on('system', 'ExtrinsicSuccess', ({blockNumber}) => flushStale(blockNumber));
}

export const notInIce = ({siblings}) =>
  siblings.find(({section, method}) => `${section}.${method}` === 'ice.SolutionExecuted') === undefined;

const intents = new Map();
const buffer = new Map();

// the intent is gone from storage once fully resolved, so read it one block back
async function loadIntent(id, blockHash) {
  const key = id.toString();
  if (!intents.has(key)) {
    const {parentHash} = await api().rpc.chain.getHeader(blockHash);
    const at = await api().at(parentHash);
    const [intent, owner] = await Promise.all([at.query.intent.intents(id), at.query.intent.intentOwner(id)]);
    const {data} = intent.unwrap();
    const {assetIn, assetOut, period} = data.isDca ? data.asDca : data.asSwap;
    intents.set(key, {who: owner.unwrap(), assetIn, assetOut, period: period?.toNumber()});
  }
  return intents.get(key);
}

async function record({event, blockNumber, blockHash}) {
  const {id, amountIn, amountOut} = event.data;
  const intent = await loadIntent(id, blockHash);
  const key = id.toString();
  const entry = buffer.get(key) || {...intent, fills: [], firstBlock: blockNumber};
  entry.fills.push({amountIn, amountOut});
  entry.lastBlock = blockNumber;
  buffer.set(key, entry);
  return entry;
}

async function fillHandler(payload) {
  const entry = await record(payload);
  // DCA intents that trade less often than the window never need batching
  if (entry.period >= window || entry.lastBlock - entry.firstBlock > window) {
    return broadcastBuffer(payload.event.data.id.toString());
  }
}

async function resolvedHandler(payload) {
  const key = payload.event.data.id.toString();
  await record(payload);
  intents.delete(key);
  return broadcastBuffer(key);
}

function closedHandler({event}) {
  const key = event.data.id.toString();
  intents.delete(key);
  return broadcastBuffer(key);
}

function flushStale(blockNumber) {
  for (const [key, {lastBlock}] of buffer) {
    if (blockNumber - lastBlock > window) {
      broadcastBuffer(key);
    }
  }
}

function broadcastBuffer(key) {
  const entry = buffer.get(key);
  if (!entry) return;
  buffer.delete(key);
  const {who, assetIn, assetOut, fills} = entry;
  const amountIn = fills.reduce((sum, {amountIn}) => sum.add(amountIn), new BN(0));
  const amountOut = fills.reduce((sum, {amountOut}) => sum.add(amountOut), new BN(0));
  const trade = {who, assetIn, assetOut, amountIn, amountOut};
  return fills.length === 1 ? swapHandler(trade) : swapHandler(trade, `split over ${fills.length} swaps`);
}

export function terminator() {
  [...buffer.keys()].map(broadcastBuffer);
}
