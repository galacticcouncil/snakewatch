import {formatAccount, formatAmount, formatAsset, loadCurrency} from "../currencies.js";
import {broadcast} from "../discord.js";
import {swapHandler} from "./xyk.js";
import {toAccount} from "../utils/evm.js";
import bilVaultAbi from "../resources/bil-vault.abi.js";
import {notInRouter} from "./router.js";

// BIL vault (ERC-4626 / ERC-7540 HOLLAR wrapper) EVM address on Hydration.
export const VAULT_ADDRESS = '0x6a21891db0940491603f3cca0a9f4dba4c6e810c';
// 2-Pool-BIL stableswap pool id (assets: BIL=55, HOLLAR=222).
export const BIL_POOL_ID = 10055;

// Hydration asset ids the feed formats amounts as. HOLLAR is the vault
// underlying; vault-share amounts are emitted in uBIL (550) units but shown as
// BIL (asset 55, the 1:1 aToken) so users see "BIL".
const HOLLAR = 222;
const BIL = 55;

// Hands 2-Pool-BIL swaps from the generic stableswap handler to this feed
// without double-posting — mirrors the isHsm carve-out.
export function isBilSwap({event}) {
  return Number(event.data.poolId) === BIL_POOL_ID;
}

const atVault = ({event: {data: {log}}}) => log.address.toString().toLowerCase() === VAULT_ADDRESS;

const hollar = amount => ({currencyId: HOLLAR, amount});
const bil = amount => ({currencyId: BIL, amount});
// HOLLAR is the value unit, so render it bold with no redundant conversion
// tilde. BIL keeps formatAsset's tilde (its HOLLAR value is informative).
const fmtHollar = amount => `**${formatAmount(hollar(amount))}**`;

export default function bilHandler(events) {
  // Pull the vault underlying + share into the currency cache; they only move
  // via evm.Log so currenciesHandler never sees them.
  Promise.all([HOLLAR, BIL].map(loadCurrency)).catch(() => {});

  events
    .onLog('Deposited', bilVaultAbi, deposited, atVault)
    .onLog('RedemptionRequested', bilVaultAbi, redemptionRequested, atVault)
    .onLog('RedemptionFulfilled', bilVaultAbi, redemptionFulfilled, atVault)
    .onLog('RedemptionPartiallyFulfilled', bilVaultAbi, redemptionPartiallyFulfilled, atVault)
    .onLog('RedemptionCancelled', bilVaultAbi, redemptionCancelled, atVault)
    .onLog('Withdraw', bilVaultAbi, withdraw, atVault)
    .onFilter('stableswap', 'SellExecuted', e => notInRouter(e) && isBilSwap(e), bilSwap)
    .onFilter('stableswap', 'BuyExecuted', e => notInRouter(e) && isBilSwap(e), bilSwap);
}

async function deposited({log: {args: {user, hollarAmount, bilMinted}}}) {
  await Promise.all([HOLLAR, BIL].map(loadCurrency));
  const account = await toAccount(user);
  const message = `${formatAccount(account)} deposited ${fmtHollar(hollarAmount)} into the 🇧🇷 BIL vault for ${await formatAsset(bil(bilMinted))}`;
  broadcast(message);
}

async function redemptionRequested({log: {args: {requestId, user, bilAmount}}}) {
  await loadCurrency(BIL);
  const account = await toAccount(user);
  const message = `${formatAccount(account)} requested 🇧🇷 BIL redemption #${requestId.toString()} of ${await formatAsset(bil(bilAmount))}`;
  broadcast(message);
}

async function redemptionFulfilled({log: {args}}) {
  await settled(args, 'fulfilled');
}

async function redemptionPartiallyFulfilled({log: {args}}) {
  await settled(args, 'partially filled');
}

async function settled({requestId, user, hollarAmount, bilBurned}, verb) {
  await Promise.all([HOLLAR, BIL].map(loadCurrency));
  const account = await toAccount(user);
  const message = `🇧🇷 BIL redemption #${requestId.toString()} ${verb} for ${formatAccount(account)}: ${await formatAsset(bil(bilBurned))} → ${fmtHollar(hollarAmount)}`;
  broadcast(message);
}

async function redemptionCancelled({log: {args: {requestId, bilReturned}}}) {
  await loadCurrency(BIL);
  const message = `🇧🇷 BIL redemption #${requestId.toString()} cancelled, ${await formatAsset(bil(bilReturned))} returned`;
  broadcast(message);
}

async function withdraw({log: {args: {receiver, assets, shares}}}) {
  await Promise.all([HOLLAR, BIL].map(loadCurrency));
  const account = await toAccount(receiver);
  const message = `${formatAccount(account)} claimed ${fmtHollar(assets)} from the 🇧🇷 BIL vault, burning ${await formatAsset(bil(shares))}`;
  broadcast(message);
}

function bilSwap({event}) {
  const {who, assetIn, assetOut, amountIn, amountOut} = event.data;
  return swapHandler({who, assetIn, assetOut, amountIn, amountOut});
}
