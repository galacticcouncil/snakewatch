import { decodeAddress } from "@polkadot/util-crypto";
import {api} from "../api.js";
import memoize from "memoizee";
import {hexToU8a, stringToU8a, u8aConcat} from "@polkadot/util";
import ethers from "ethers";
import {rpc} from "../config.js";

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

export async function toAccount(address) {
  const evmAddress = normalizeAddress(address);
  const extension = await loadExtension(evmAddress);
  const pk = extension
    ? u8aConcat(hexToU8a(evmAddress), hexToU8a(extension))
    : u8aConcat(stringToU8a('ETH\0'), hexToU8a(evmAddress), new Uint8Array(8));
  return api().createType("AccountId", pk);
}

export function toAddress(account) {
  if (isEvmAccount(account)) {
    return fromAccount(account);
  } else {
    return '0x' + account.slice(2, 42);
  }
}

export function normalizeAddress(address) {
  return '0x' + address.slice(-40);
}

export const provider = new ethers.providers.StaticJsonRpcProvider(convertWsToHttp(rpc), {chainId: 222222, name: 'hydration'});

function convertWsToHttp(url) {
  if (typeof url !== 'string') return url;
  return url
    .replace(/^wss:\/\//i, 'https://')
    .replace(/^ws:\/\//i, 'http://');
}
