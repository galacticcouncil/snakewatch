import {swapHandler} from "./xyk.js";
import {emojify} from "../utils/emojify.js";
import {BN} from "@polkadot/util";
import process from 'node:process';

export default function otcHandler(events) {
  events
    .on('dca', 'TradeExecuted', tradeExecuted)
    .on('dca', 'Terminated', terminatedHandler)
}

export const notInDca = ({siblings}) => siblings.find(({method}) => ['ExecutionStarted'].includes(method)) === undefined;

const window = 50;
let buffer = [];

async function tradeExecuted({event, siblings, blockNumber}) {
  const {who} = event.data;
  const scheduleId = event.data.id.toNumber();
  const id = scheduleId;
  const trade = siblings
    .slice(0, siblings.indexOf(event))
    .reverse()
    .find(({method}) => method === 'RouteExecuted');
  const nextBlock = siblings
    .slice(siblings.indexOf(event) + 1)
    .find(({method}) => method === 'ExecutionPlanned')
    ?.data.block.toNumber();
  if (nextBlock && nextBlock - blockNumber < window) {
    buffer.push({id, who, trade, blockNumber, nextBlock});
    const executions = buffer.filter(({id}) => id === scheduleId);
    const minBlock = executions.reduce((min, {blockNumber}) => Math.min(min, blockNumber), Infinity);
    const maxBlock = executions.reduce((max, {blockNumber}) => Math.max(max, blockNumber), 0);
    if (maxBlock - minBlock > window) {
      return broadcastBuffer(scheduleId);
    }
  } else {
    if (buffer.find(({id}) => id === scheduleId)) {
      buffer.push({id, who, trade, blockNumber, nextBlock});
      return broadcastBuffer(scheduleId);
    } else {
      return swapHandler({who, ...trade.data}, emojify(who));
    }
  }
}

function terminatedHandler({event}) {
  const scheduleId = event.data.id.toNumber();
  if (buffer.find(({id}) => id === scheduleId)) {
    return broadcastBuffer(scheduleId);
  }
}

function broadcastBuffer(scheduleId) {
  const executions = buffer.filter(({id}) => id === scheduleId);
  buffer = buffer.filter(({id}) => id !== scheduleId);
  const {who} = executions[0];
  const {assetIn, assetOut} = executions[0].trade.data;
  const amountIn = executions.reduce((sum, {trade}) => sum.add(trade.data.amountIn), new BN(0));
  const amountOut = executions.reduce((sum, {trade}) => sum.add(trade.data.amountOut), new BN(0));
  if (executions.length === 1) {
    return swapHandler({who, assetIn, assetOut, amountIn, amountOut}, emojify(who));
  } else {
    return swapHandler({
      who,
      assetIn,
      assetOut,
      amountIn,
      amountOut
    }, emojify(who), `split over ${executions.length} swaps`);
  }
}

function terminator() {
  const ids = new Set(buffer.map(({id}) => id));
  [...ids].map(broadcastBuffer);
}

['SIGHUP', 'SIGINT', 'SIGQUIT', 'SIGILL', 'SIGTRAP', 'SIGABRT',
  'SIGBUS', 'SIGFPE', 'SIGUSR1', 'SIGSEGV', 'SIGUSR2', 'SIGTERM'
].forEach(sig =>
  process.on(sig, () => {
    terminator();
    setTimeout(() => process.exit(0), 500);
  }));

