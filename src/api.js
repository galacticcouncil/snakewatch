import {ApiPromise, WsProvider} from "@polkadot/api";
import {PoolService, TradeRouter} from "@galacticcouncil/sdk";

let initialized = false;
let ready = false;
let _api;
let _poolService;
let _router;
let provider;

export async function initApi(rpc) {
  console.warn = () => {};
  provider = new WsProvider(rpc);
  _api = await ApiPromise.create({provider});
  initialized = true;
  const version = await _api.query.system.lastRuntimeUpgrade();
  const {specVersion, specName} = version.toJSON();
  console.log(`connected to ${specName}/${specVersion} on ${rpc}`);
}

export async function initSdk(api) {
  _poolService = new PoolService(api);
  await _poolService.syncRegistry();
  _router = new TradeRouter(_poolService);
  ready = true;
}

export async function disconnect() {
  await _api.disconnect();
  await _poolService.disconnect();
  provider = null;
  _api = null;
  _poolService = null;
  _router = null;
  initialized = false;
  ready = false;
}

export function api() {
  if (!initialized || !_api) {
    throw new Error('api not initialized');
  }
  return _api;
}

export function sdk() {
  if (!ready || !_router) {
    throw new Error('router not ready');
  }
  return {
    router: _router,
    poolService: _poolService
  };
}
