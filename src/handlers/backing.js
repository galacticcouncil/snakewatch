import ethers from "ethers";
import {api} from "../api.js";
import {broadcast} from "../discord.js";
import {getAlerts} from "../utils/alerts.js";
import {metrics} from "../metrics.js";
import {endpoints} from "../endpoints.js";
import {NTT_DEPLOYMENTS, wormholeChain} from "../utils/ntt.js";
import {normalizeTo8dp, assessBacking} from "../utils/backing.js";
import erc20Abi from "../resources/erc20.abi.js";
import {
  ethRpc, baseRpc, solanaRpc, suiRpc,
  backingIntervalSeconds, backingThreshold, backingReAlertHours, backingDisabled,
} from "../config.js";

// Each NTT asset's Hydration issuance must be backed by underlying custodied on
// the origin (locking) hub. Custody is balance-based on every platform, so this
// monitor periodically compares hub custody against Tokens.TotalIssuance and
// alerts when custody < issuance (an under-collateralised, therefore unsafe,
// bridge state). See src/utils/ntt.js for the audited hub-custody addresses.

const backingMetrics = metrics.register("backing", {
  custody: {type: "gauge", help: "Underlying held by the NTT hub custody (human units)", labels: ["asset", "chain"]},
  issuance: {type: "gauge", help: "Hydration issuance backed by the NTT hub (human units)", labels: ["asset"]},
  ratio: {type: "gauge", help: "custody / issuance (>= 1 is fully backed)", labels: ["asset"]},
  sufficient: {type: "gauge", help: "1 when custody >= issuance, else 0", labels: ["asset"]},
  shortfall: {type: "gauge", help: "issuance not covered by custody (human units, 0 when healthy)", labels: ["asset"]},
  check_errors_total: {type: "counter", help: "Backing checks that could not complete", labels: ["asset", "chain"]},
});

// per-asset alert state so we alert on transition + on a slow re-alert cadence, not every tick
const state = new Map(); // symbol -> {sufficient, lastAlertAt}
const lastReport = new Map(); // symbol -> latest computed snapshot (for the /backing endpoint)

const evmProviders = new Map();
function evmProvider(peerChainId) {
  const [url, chainId, name] = peerChainId === 30
    ? [baseRpc, 8453, "base"]
    : [ethRpc, 1, "ethereum"];
  if (!evmProviders.has(chainId)) evmProviders.set(chainId, new ethers.providers.StaticJsonRpcProvider(url, {chainId, name}));
  return evmProviders.get(chainId);
}

const human8 = v8 => Number(v8) / 1e8;

async function readIssuance(deployment) {
  const total = await api().query.tokens.totalIssuance(deployment.assetId);
  return BigInt(total.toString());
}

async function readCustody(deployment) {
  const {peerChainId, hub} = deployment;
  if (peerChainId === 2 || peerChainId === 30) {
    const c = new ethers.Contract(hub.token, erc20Abi, evmProvider(peerChainId));
    const bal = await c.balanceOf(hub.custody);
    return BigInt(bal.toString());
  }
  if (peerChainId === 1) return readSolanaCustody(hub.custody);
  if (peerChainId === 21) return readSuiCustody(hub.custody);
  throw new Error(`no custody reader for wormhole chain ${peerChainId}`);
}

async function rpc(url, method, params) {
  const res = await fetch(url, {
    method: "POST",
    headers: {"content-type": "application/json"},
    body: JSON.stringify({jsonrpc: "2.0", id: 1, method, params}),
  });
  if (!res.ok) throw new Error(`${method} http ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(`${method}: ${json.error.message}`);
  return json.result;
}

async function readSolanaCustody(account) {
  const r = await rpc(solanaRpc, "getTokenAccountBalance", [account]);
  return BigInt(r?.value?.amount ?? "0");
}

async function readSuiCustody(stateObjectId) {
  const r = await rpc(suiRpc, "sui_getObject", [stateObjectId, {showContent: true}]);
  const b = r?.data?.content?.fields?.balance;
  const value = b && typeof b === "object" ? (b.value ?? b.fields?.value) : b;
  return BigInt(value ?? "0");
}

async function checkOne(deployment) {
  const chain = wormholeChain(deployment.peerChainId);
  let issuance8, custody8;
  try {
    const [issuanceRaw, custodyRaw] = await Promise.all([readIssuance(deployment), readCustody(deployment)]);
    issuance8 = normalizeTo8dp(issuanceRaw, await hydrationDecimals(deployment.assetId));
    custody8 = normalizeTo8dp(custodyRaw, deployment.hub.decimals);
  } catch (err) {
    backingMetrics.check_errors_total.inc({asset: deployment.symbol, chain});
    console.error(`backing: ${deployment.symbol} check failed:`, err?.message ?? err);
    return null;
  }

  const {ratio, shortfall8, sufficient} = assessBacking(issuance8, custody8, backingThreshold);
  const snapshot = {
    symbol: deployment.symbol, chain,
    issuance: human8(issuance8), custody: human8(custody8),
    ratio: Number.isFinite(ratio) ? Number(ratio.toFixed(6)) : null,
    shortfall: human8(shortfall8), sufficient, at: new Date().toISOString(),
  };
  lastReport.set(deployment.symbol, snapshot);

  backingMetrics.custody.set({asset: deployment.symbol, chain}, snapshot.custody);
  backingMetrics.issuance.set({asset: deployment.symbol}, snapshot.issuance);
  backingMetrics.ratio.set({asset: deployment.symbol}, Number.isFinite(ratio) ? ratio : 1);
  backingMetrics.sufficient.set({asset: deployment.symbol}, sufficient ? 1 : 0);
  backingMetrics.shortfall.set({asset: deployment.symbol}, snapshot.shortfall);

  await maybeAlert(deployment, snapshot);
  return snapshot;
}

async function maybeAlert(deployment, snap) {
  const prev = state.get(deployment.symbol);
  const now = Date.now();
  const reAlertMs = backingReAlertHours * 3600 * 1000;

  if (!snap.sufficient) {
    const becameUnhealthy = !prev || prev.sufficient;
    const dueForRepeat = prev && !prev.sufficient && now - prev.lastAlertAt >= reAlertMs;
    if (becameUnhealthy || dueForRepeat) {
      const pct = snap.ratio === null ? "0" : (snap.ratio * 100).toFixed(2);
      const message = `${deployment.symbol} NTT backing INSUFFICIENT on ${snap.chain}: custody ${fmt(snap.custody)} < issuance ${fmt(snap.issuance)} (${pct}% backed, shortfall ${fmt(snap.shortfall)} ${deployment.symbol})`;
      broadcast(`🚨 ${message}`);
      await getAlerts().sendWebhooks(`🚨 **NTT BACKING INSUFFICIENT** - ${message}`);
      state.set(deployment.symbol, {sufficient: false, lastAlertAt: now});
      return;
    }
    state.set(deployment.symbol, {sufficient: false, lastAlertAt: prev?.lastAlertAt ?? now});
    return;
  }

  if (prev && !prev.sufficient) {
    const message = `${deployment.symbol} NTT backing restored on ${snap.chain}: custody ${fmt(snap.custody)} >= issuance ${fmt(snap.issuance)} (${(snap.ratio * 100).toFixed(2)}% backed)`;
    broadcast(`✅ ${message}`);
    await getAlerts().sendWebhooks(`✅ **NTT BACKING RESTORED** - ${message}`);
  }
  state.set(deployment.symbol, {sufficient: true, lastAlertAt: prev?.lastAlertAt ?? 0});
}

const fmt = n => n.toLocaleString("en-US", {maximumFractionDigits: 8});

const decimalsCache = new Map();
async function hydrationDecimals(assetId) {
  if (decimalsCache.has(assetId)) return decimalsCache.get(assetId);
  const asset = await api().query.assetRegistry.assets(assetId);
  const human = asset.toHuman?.() ?? {};
  const decimals = Number(human.decimals ?? 0) || 0;
  decimalsCache.set(assetId, decimals);
  return decimals;
}

export async function checkAllBacking() {
  return Promise.all(NTT_DEPLOYMENTS.map(checkOne));
}

let timer = null;

export default function backing() {
  endpoints.registerEndpoint("backing", {
    "/": {GET: (_, res) => res.json({threshold: backingThreshold, assets: Object.fromEntries(lastReport)})},
  });

  if (backingDisabled) {
    console.log("ntt backing monitor disabled (BACKING_DISABLED)");
    return;
  }

  console.log(`watching NTT backing (every ${backingIntervalSeconds}s, threshold ${backingThreshold})`);
  const run = () => checkAllBacking().catch(err => console.error("backing: sweep failed:", err?.message ?? err));
  run();
  timer = setInterval(run, backingIntervalSeconds * 1000);
  if (timer.unref) timer.unref();
}

export function stopBacking() {
  if (timer) clearInterval(timer);
  timer = null;
}
