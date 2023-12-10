import { decodeAddress } from "@polkadot/util-crypto";

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
