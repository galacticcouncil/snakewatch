import {ApiPromise, WsProvider} from "@polkadot/api";

let initialized = false;
let _api;
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



