import ethers from "ethers";
import {api} from "../api.js";
import {provider} from "./evm.js";

// well-known 4-byte selectors, enough to fingerprint the usual suspects
const SELECTOR_NAMES = {
  '0xa9059cbb': 'transfer',
  '0x23b872dd': 'transferFrom',
  '0x095ea7b3': 'approve',
  '0x70a08231': 'balanceOf',
  '0x18160ddd': 'totalSupply',
  '0x06fdde03': 'name',
  '0x95d89b41': 'symbol',
  '0x313ce567': 'decimals',
  '0xdd62ed3e': 'allowance',
  '0x40c10f19': 'mint',
  '0x42966c68': 'burn',
  '0x8da5cb5b': 'owner',
  '0xf2fde38b': 'transferOwnership',
  '0x715018a6': 'renounceOwnership',
  '0x8456cb59': 'pause',
  '0x3f4ba83a': 'unpause',
  '0x3659cfe6': 'upgradeTo',
  '0x4f1ef286': 'upgradeToAndCall',
  '0x5c60da1b': 'implementation',
  '0x8129fc1c': 'initialize',
  '0xc4d66de8': 'initialize',
  '0x01ffc9a7': 'supportsInterface',
  '0x6352211e': 'ownerOf',
  '0x42842e0e': 'safeTransferFrom',
  '0xb88d4fde': 'safeTransferFrom',
  '0xa22cb465': 'setApprovalForAll',
  '0xf242432a': 'safeTransferFrom',
  '0x2eb2c2d6': 'safeBatchTransferFrom',
  '0xd0e30db0': 'deposit',
  '0x6e553f65': 'deposit',
  '0x2e1a7d4d': 'withdraw',
  '0xb460af94': 'withdraw',
  '0x38d52e0f': 'asset',
  '0x94bf804d': 'mint',
  '0xba087652': 'redeem',
  '0x022c0d9f': 'swap',
  '0x128acb08': 'swap',
  '0xac9650d8': 'multicall',
  '0x1cff79cd': 'execute',
  '0x5cffe9de': 'flashLoan',
  '0xab9c4b5d': 'flashLoan',
};

// eip-1967 storage slots
const IMPL_SLOT = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';
const ADMIN_SLOT = '0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103';
const BEACON_SLOT = '0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50';

const ERC20_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function owner() view returns (address)',
];

// resolve to null instead of hanging/rejecting so a wedged rpc can't stall the alert
export const attempt = (fn, ms = 4000) => Promise.race([
  Promise.resolve().then(fn).catch(() => null),
  new Promise(resolve => setTimeout(() => resolve(null), ms).unref?.()),
]);

// solidity appends cbor metadata (…"solc"…) with a 2-byte length suffix — and embeds the
// same block mid-buffer for every sub-assembly (child creation code of `new Child()`).
// cut at the earliest byte-aligned marker so random hash bytes never decode as opcodes;
// fall back to the trailing-length heuristic for exotic layouts.
export function stripMetadata(code) {
  const hex = code.toString('hex');
  const marker = /a264697066735822|a165627a7a723058|a265627a7a72315820/g;
  for (let m; (m = marker.exec(hex));) {
    if (m.index % 2 === 0) return code.subarray(0, m.index / 2);
    marker.lastIndex = m.index + 1;
  }
  if (code.length < 4) return code;
  const len = (code[code.length - 2] << 8) | code[code.length - 1];
  const start = code.length - 2 - len;
  if (len > 0 && start >= 0 && (code[start] & 0xf0) === 0xa0) return code.subarray(0, start);
  return code;
}

// static bytecode analysis: size, dispatcher selectors, risky opcodes, minimal-proxy target.
// walks opcodes skipping PUSH immediates, so data bytes don't count as instructions.
export function analyzeBytecode(codeHex) {
  const hex = (codeHex || '0x').replace(/^0x/, '').toLowerCase();
  const intel = {size: hex.length / 2, selectors: [], names: [], flags: [], minimalProxyImpl: null, kind: null};
  if (!hex.length) return intel;

  const clone = hex.match(/^363d3d373d3d3d363d73([0-9a-f]{40})5af43d82803e903d91602b57fd5bf3$/)
    || hex.match(/^3d3d3d3d363d3d37363d73([0-9a-f]{40})5af43d3d93803e602a57fd5bf3$/); // solady
  if (clone) {
    intel.minimalProxyImpl = '0x' + clone[1];
    intel.kind = 'EIP-1167 minimal proxy';
    return intel;
  }

  const code = stripMetadata(Buffer.from(hex, 'hex'));
  const selectors = new Set();
  const flags = new Set();
  let lastCompare = -1;
  for (let i = 0; i < code.length; i++) {
    const op = code[i];
    if (op >= 0x60 && op <= 0x7f) { // PUSHn — skip immediate
      const n = op - 0x5f;
      // PUSH4 <sel> followed by EQ / SUB / XOR — dispatcher compare (legacy and via-ir).
      // compares sit densely packed; a distant hit is an embedded child's dispatcher, not ours
      if (op === 0x63 && [0x14, 0x03, 0x18].includes(code[i + 5])
        && (lastCompare === -1 || i - lastCompare <= 256)) {
        selectors.add('0x' + code.subarray(i + 1, i + 5).toString('hex'));
        lastCompare = i;
      }
      i += n;
    } else if (op === 0xff) flags.add('selfdestruct');
    else if (op === 0xf4) flags.add('delegatecall');
    else if (op === 0xf5) flags.add('create2');
    else if (op === 0xf0) flags.add('create');
  }
  intel.selectors = [...selectors];
  intel.names = intel.selectors.map(s => SELECTOR_NAMES[s]).filter(Boolean);
  intel.flags = [...flags];
  intel.kind = classify(new Set(intel.selectors));
  return intel;
}

function classify(s) {
  const all = (...xs) => xs.every(x => s.has(x));
  if (all('0xf242432a', '0x2eb2c2d6')) return 'ERC1155';
  if (all('0x6352211e', '0xa22cb465')) return 'ERC721';
  if (all('0x6e553f65', '0xba087652', '0x38d52e0f')) return 'ERC4626 vault';
  if (all('0xa9059cbb', '0x095ea7b3', '0x70a08231', '0x18160ddd')) return 'ERC20';
  if (s.has('0x3659cfe6') || s.has('0x4f1ef286')) return 'upgradeable (UUPS)';
  return null;
}

// live probes against the fresh contract: eip-1967 slots and token metadata.
// everything best-effort — a dead probe degrades the alert, never blocks it.
export async function probeContract(address) {
  const probe = {};
  const token = new ethers.Contract(address, ERC20_ABI, provider);
  const [impl, admin, beacon, name, symbol, decimals, totalSupply, owner] = await Promise.all([
    ...[IMPL_SLOT, ADMIN_SLOT, BEACON_SLOT].map(slot =>
      attempt(() => provider.getStorageAt(address, slot).then(slotAddress))),
    attempt(() => token.name()),
    attempt(() => token.symbol()),
    attempt(() => token.decimals()),
    attempt(() => token.totalSupply()),
    attempt(() => token.owner().then(o => o === ethers.constants.AddressZero ? null : o)),
  ]);
  if (impl) Object.assign(probe, {impl, admin, beacon, proxy: 'EIP-1967'});
  else if (beacon) {
    // beacon proxies keep the implementation on the beacon, not in the proxy
    const beaconImpl = await attempt(() =>
      new ethers.Contract(beacon, ['function implementation() view returns (address)'], provider)
        .implementation());
    Object.assign(probe, {impl: beaconImpl, beacon, proxy: 'EIP-1967 beacon'});
  }
  if (name || symbol) {
    // keep supply as the exact decimal string — Number() fabricates digits past 2^53
    const supply = totalSupply != null && decimals != null
      ? ethers.utils.formatUnits(totalSupply, decimals) : null;
    Object.assign(probe, {name: sanitizeLabel(name), symbol: sanitizeLabel(symbol), decimals, supply});
  }
  if (owner) probe.owner = owner;
  return probe;
}

// token names come from whoever deployed the contract — keep them from smuggling
// markdown, mentions or walls of text into the alert channel
export const sanitizeLabel = s => typeof s === 'string'
  ? s.replace(/[`\n\r@]/g, '').trim().slice(0, 48) || null
  : s;

const slotAddress = word => {
  if (!word || word === ethers.constants.HashZero) return null;
  const address = ethers.utils.getAddress('0x' + word.slice(-40));
  return address === ethers.constants.AddressZero ? null : address;
};

// who deployed it: on-chain activity and whether the evm address is bound to a substrate account
export async function probeDeployer(address) {
  const [txCount, bound] = await Promise.all([
    attempt(() => provider.getTransactionCount(address)),
    attempt(async () => {
      const extension = await api().query.evmAccounts.accountExtension(address);
      return !extension.isEmpty;
    }),
  ]);
  // bound stays null when the probe failed — unknown is not "unbound"
  return {address, txCount, bound};
}
