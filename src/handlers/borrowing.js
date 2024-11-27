import {formatAccount, formatAsset} from "../currencies.js";
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
    .onLog('LiquidationCall', poolAbi, liquidationCall)
}

async function supply({log: {args: {reserve, amount, onBehalfOf}}}) {
  const supplied = {currencyId: ERC20Mapping.decodeEvmAddress(reserve), amount}
  const account = await toAccount(onBehalfOf);
  const message = `${formatAccount(account)} supplied ${formatAsset(supplied)}`;
  broadcast(message);
}

async function withdraw({log: {args: {reserve, amount, to}}}) {
  const withdrew = {currencyId: ERC20Mapping.decodeEvmAddress(reserve), amount}
  const account = await toAccount(to);
  const message = `${formatAccount(account)} withdrew ${formatAsset(withdrew)}`;
  broadcast(message);
}

async function borrow({log: {args: {reserve, amount, onBehalfOf}}}) {
  const borrowed = {currencyId: ERC20Mapping.decodeEvmAddress(reserve), amount}
  const account = await toAccount(onBehalfOf);
  const message = `${formatAccount(account)} borrowed ${formatAsset(borrowed)}`;
  broadcast(message);
}

async function repay({log: {args: {reserve, amount, user}}}) {
  const repaid = {currencyId: ERC20Mapping.decodeEvmAddress(reserve), amount}
  const account = await toAccount(user);
  const message = `${formatAccount(account)} repaid ${formatAsset(repaid)}`;
  broadcast(message);
}

async function liquidationCall({log: {args}}) {
  const collateral = {currencyId: ERC20Mapping.decodeEvmAddress(args.collateralAsset), amount: args.liquidatedCollateralAmount}
  const [liquidator, user] = await Promise.all([toAccount(args.liquidator), toAccount(args.user)]);
  const message = `${formatAccount(liquidator)} liquidated ${formatAsset(collateral)} of ${formatAccount(user)}`;
  broadcast(message);
}
