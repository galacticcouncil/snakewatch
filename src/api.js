import {ApiPromise, WsProvider} from "@polkadot/api";
import {PoolService, TradeRouter} from "@galacticcouncil/sdk";
import { EvmClient } from "@galacticcouncil/sdk";

let initialized = false;
let _api;
let _sdk;
let provider;

export async function initApi(rpc) {
  console.warn = () => {};
  provider = new WsProvider(rpc);
  _api = await ApiPromise.create({provider});
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
