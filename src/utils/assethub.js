import {ApiPromise, WsProvider} from "@polkadot/api";
import {ahRpc} from "../config.js";

let _api;

async function api() {
  if (!_api && ahRpc) {
    const provider = new WsProvider(ahRpc);
    _api = await ApiPromise.create({provider});
  }
  return _api;
}

export async function metadata(id) {
  return (await api())?.query.assets.metadata(id);
}
