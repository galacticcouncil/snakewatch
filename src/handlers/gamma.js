import {formatAccount, formatAmount, isWhale, loadCurrency, usdValue} from "../currencies.js";
import {broadcast} from "../discord.js";
import {toAccount} from "../utils/evm.js";
import hypervisorAbi from "../resources/gamma-hypervisor.abi.js";

// Gamma Hypervisor vaults on Hydration, keyed by lowercase EVM address. Each
// vault wraps one concentrated-liquidity pool; token0 / token1 are the
// Hydration asset ids behind the pool's ERC20s (Uniswap orders them by
// address, so the order is fixed per pool and recorded here).
export const VAULTS = {
  // aDOT/HOLLAR 0.3% pool 0x5C6208A3c316A801f8996750aA7b6f45Fc988548
  '0xa206d0959813f17c17c87147271c49065438648a': {token0: 1001, token1: 222},
};

export const vaultOf = ({event: {data: {log}}}) => VAULTS[log.address.toString().toLowerCase()];
const atVault = payload => vaultOf(payload) !== undefined;

// Deposits / withdrawals only. Swaps through the pool are already narrated by
// the router feed and keeper rebalances are noise.
export default function gammaHandler(events) {
  // Pool assets only move via evm.Log here, so currenciesHandler never loads
  // them; warm the currency cache up front.
  const assets = new Set(Object.values(VAULTS).flatMap(({token0, token1}) => [token0, token1]));
  Promise.all([...assets].map(loadCurrency)).catch(() => {});

  events
    .onLog('Deposit', hypervisorAbi, deposit, atVault)
    .onLog('Withdraw', hypervisorAbi, withdraw, atVault);
}

const deposit = payload => narrate(payload, '💦', 'added');
const withdraw = payload => narrate(payload, '🚰', 'removed');

// `💦 **13.6 aDOT** + **106.8 HOLLAR** liquidity added by 🐞ukg`
// Single-sided legs (amount 0) are dropped rather than shown as "0 X" — the
// Hypervisor accepts one-sided deposits within its ratio band. The USD value is
// only used to pick the whale icon.
async function narrate(payload, emoji, verb) {
  const {token0, token1} = vaultOf(payload);
  const {sender, amount0, amount1} = payload.log.args;
  await Promise.all([token0, token1].map(loadCurrency));
  const amounts = [
    {currencyId: token0, amount: amount0.toString()},
    {currencyId: token1, amount: amount1.toString()},
  ].filter(({amount}) => amount !== '0');
  const values = await Promise.all(amounts.map(usdValue));
  const value = values.every(v => v) ? values.reduce((a, b) => a + b, 0) : null;
  const legs = amounts.map(a => `**${formatAmount(a)}**`).join(' + ');
  const who = formatAccount(await toAccount(sender), isWhale(value));
  broadcast(`${emoji} ${legs} liquidity ${verb} by ${who}`);
}
