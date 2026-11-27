import {ApiPromise, WsProvider} from "@polkadot/api";
import {AssetClient, PoolService, TradeRouter} from "@galacticcouncil/sdk";
import { EvmClient } from "@galacticcouncil/sdk";

// share assets can outlive their pool (105 since hydradx/458); sdk assumes they can't
const getShares = AssetClient.prototype.getShares;
AssetClient.prototype.getShares = function (id, asset, metadata, pool) {
  return pool
    ? getShares.call(this, id, asset, metadata, pool)
    : this.getToken(id, asset, metadata);
};

let initialized = false;
let _api;
let _sdk;
let provider;

const CONNECT_TIMEOUT_MS = Number(process.env.RPC_CONNECT_TIMEOUT_MS) || 30_000;

export async function initApi(rpc) {
  console.warn = () => {};
  provider = new WsProvider(rpc);
  const ready = ApiPromise.create({provider});
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`rpc connect timeout after ${CONNECT_TIMEOUT_MS}ms: ${rpc}`)),
      CONNECT_TIMEOUT_MS,
    );
  });
  try {
    _api = await Promise.race([ready, timeout]);
  } finally {
    clearTimeout(timer);
  }
  const evm = new EvmClient(_api);
  const poolService = new PoolService(_api, evm);
  _sdk = new TradeRouter(poolService);
  initialized = true;
  const version = await _api.query.system.lastRuntimeUpgrade();
  const {specVersion, specName} = version.toJSON();
  console.log(`connected to ${specName}/${specVersion} on ${rpc}`);
  await poolService.syncRegistry();
}

export async function disconnect() {
  await _api.disconnect();
  provider = null;
  _api = null;
  initialized = false;
}

export function api() {
  if (!initialized || !_api) {
    throw new Error('api not initialized');
  }
  return _api;
}

export function sdk() {
  if (!initialized || !_sdk) {
    throw new Error('router not synced');
  }
  return _sdk;
}
