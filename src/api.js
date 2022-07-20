import {ApiPromise, WsProvider} from "@polkadot/api";

let initialized = false;
let _api;
let provider;

export async function initApi(rpc) {
  provider = new WsProvider(rpc);
  _api = await ApiPromise.create({provider});
  initialized = true;
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



