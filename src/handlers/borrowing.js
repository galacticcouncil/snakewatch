import {formatAccount, formatAmount, formatUsdValue, usdValue} from "../currencies.js";
import {broadcast} from "../discord.js";
import poolAbi from "../resources/aave-pool.abi.js";
import ERC20Mapping from "../utils/erc20mapping.js";
import {toAccount} from "../utils/evm.js";

export default function borrowingHandler(events) {
  events
    .onLog('Supply', poolAbi, supply)
    .onLog('Withdraw', poolAbi, withdraw)
    .onLog('Borrow', poolAbi, borrow)
    .onLog('Repay', poolAbi, repay)
}

async function supply({log: {args: {reserve, amount, onBehalfOf}}}) {
  const supplied = {currencyId: ERC20Mapping.decodeEvmAddress(reserve), amount}
  const account = await toAccount(onBehalfOf);
  const message = `${formatAccount(account)} supplied **${formatAmount(supplied)}**${formatUsdValue(usdValue(amount))} to 🏦`;
  broadcast(message);
}

async function withdraw({log: {args: {reserve, amount, to}}}) {
  const withdrew = {currencyId: ERC20Mapping.decodeEvmAddress(reserve), amount}
  const account = await toAccount(to);
  const message = `${formatAccount(account)} withdrew **${formatAmount(withdrew)}**${formatUsdValue(usdValue(amount))} from 🏦`;
  broadcast(message);
}

async function borrow({log: {args: {reserve, amount, onBehalfOf}}}) {
  const borrowed = {currencyId: ERC20Mapping.decodeEvmAddress(reserve), amount}
  const account = await toAccount(onBehalfOf);
  const message = `${formatAccount(account)} borrowed **${formatAmount(borrowed)}**${formatUsdValue(usdValue(amount))} from 🏦`;
  broadcast(message);
}

async function repay({log: {args: {reserve, amount, user}}}) {
  const repaid = {currencyId: ERC20Mapping.decodeEvmAddress(reserve), amount}
  const account = await toAccount(user);
  const message = `${formatAccount(account)} repaid **${formatAmount(repaid)}**${formatUsdValue(usdValue(amount))} to 🏦`;
  broadcast(message);
}
