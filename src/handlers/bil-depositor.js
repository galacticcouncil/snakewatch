import ethers from "ethers";

// BIL Aave pool — emits the Supply whose `onBehalfOf` is the real depositor.
export const BIL_POOL_ADDRESS = '0x69310fda58c819ad82df7d2cb61841c853337a53';

const supplyIface = new ethers.utils.Interface([
  'event Supply(address indexed reserve, address user, address indexed onBehalfOf, uint256 amount, uint16 indexed referralCode)',
]);

// True when an Aave evm.Log came from the BIL pool. The BIL feed narrates the
// vault's deposit / redemption lifecycle — the only source of the BIL pool's
// uBIL supplies and withdraws — so the generic borrowing handler skips those to
// avoid a duplicate "supplied/withdrew uBIL" line next to the vault message.
export function isBilPool(payload) {
  const addr = payload?.event?.data?.log?.address?.toString?.();
  return addr?.toLowerCase() === BIL_POOL_ADDRESS;
}

// Deposits route through BILDepositZap, so the vault's `Deposited` event records
// the zap as `user` (not the depositor). The real depositor is the BIL pool's
// `Supply.onBehalfOf` emitted in the same extrinsic — the account that receives
// the aBIL collateral. Scan the sibling evm.Log events for it; fall back to the
// vault arg on any miss (e.g. a vault-only deposit with no Aave layer).
//
// Pure (ethers-only) so it can be unit-tested without pulling the handler's
// polkadot/RPC dependency chain into the test runner.
export function realDepositor(payload, fallback) {
  for (const ev of payload.siblings ?? []) {
    if (ev.section?.toString() !== 'evm' || ev.method?.toString() !== 'Log') continue;
    let log;
    try {
      log = ev.data.log.toHuman();
    } catch {
      continue;
    }
    if (log?.address?.toLowerCase() !== BIL_POOL_ADDRESS) continue;
    try {
      const parsed = supplyIface.parseLog(log);
      if (parsed.name === 'Supply') return parsed.args.onBehalfOf;
    } catch {
      // pool log that isn't a Supply — keep scanning
    }
  }
  return fallback;
}
