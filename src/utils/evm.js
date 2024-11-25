import { decodeAddress } from "@polkadot/util-crypto";
import {api} from "../api.js";
import memoize from "memoizee";
import {hexToU8a, stringToU8a, u8aConcat} from "@polkadot/util";

const prefixBytes = Buffer.from("ETH\0");

export function isEvmAccount(address) {
  if (!address) return false;

  try {
    const pub = decodeAddress(address, true);
    return Buffer.from(pub.subarray(0, prefixBytes.length)).equals(prefixBytes);
  } catch {
    return false;
  }
}

export function fromAccount(address) {
  if (!isEvmAccount(address)) {
    return null;
  }
  const decodedBytes = decodeAddress(address);
  const addressBytes = decodedBytes.slice(prefixBytes.length, -8);
  return Buffer.from(addressBytes).toString("hex");
}

const loadExtension = memoize(async (evmAddress) => {
  const extension = await api().query.evmAccounts.accountExtension(evmAddress);
  return extension.toHuman();
}, {promise: true, primitive: true});

export async function toAccount(evmAddress) {
  const extension = await loadExtension(evmAddress);
  const pk = extension
    ? u8aConcat(hexToU8a(evmAddress), hexToU8a(extension))
    : u8aConcat(stringToU8a('ETH\0'), hexToU8a(evmAddress), new Uint8Array(8));
  return api().createType("AccountId", pk);
}
