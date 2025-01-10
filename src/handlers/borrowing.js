import {formatAccount, formatAsset} from "../currencies.js";
import {broadcast} from "../discord.js";
import poolAbi from "../resources/aave-pool.abi.js";
import oracleAbi from "../resources/dia-oracle.abi.js";
import ERC20Mapping from "../utils/erc20mapping.js";
import {toAccount} from "../utils/evm.js";
import Borrowers from "../utils/borrowers.js";

const borrowers = new Borrowers();

export default function borrowingHandler(events) {
  borrowers.init();
  events
    .onLog('Supply', poolAbi, borrowers.handler(supply))
    .onLog('Withdraw', poolAbi, borrowers.handler(withdraw))
    .onLog('Borrow', poolAbi, borrowers.handler(borrow))
    .onLog('Repay', poolAbi, borrowers.handler(repay))
    .onLog('LiquidationCall', poolAbi, borrowers.handler(liquidationCall))
    .onLog('OracleUpdate', oracleAbi, oracleUpdate);
}

async function supply({log: {args: {reserve, amount, onBehalfOf}}}) {
  const supplied = {currencyId: ERC20Mapping.decodeEvmAddress(reserve), amount}
  const account = await toAccount(onBehalfOf);
  const message = `${formatAccount(account)} supplied ${await formatAsset(supplied)}`;
  broadcast(message);
}

async function withdraw({log: {args: {reserve, amount, to}}}) {
  const withdrew = {currencyId: ERC20Mapping.decodeEvmAddress(reserve), amount}
  const account = await toAccount(to);
  const message = `${formatAccount(account)} withdrew ${await formatAsset(withdrew)}`;
  broadcast(message);
}

async function borrow({log: {args: {reserve, amount, onBehalfOf}}}) {
  const borrowed = {currencyId: ERC20Mapping.decodeEvmAddress(reserve), amount}
  const account = await toAccount(onBehalfOf);
  const message = `${formatAccount(account)} borrowed ${await formatAsset(borrowed)}`;
  broadcast(message);
}

async function repay({log: {args: {reserve, amount, user}}}) {
  const repaid = {currencyId: ERC20Mapping.decodeEvmAddress(reserve), amount}
  const account = await toAccount(user);
  const message = `${formatAccount(account)} repaid ${await formatAsset(repaid)}`;
  broadcast(message);
}

async function liquidationCall({log: {args}}) {
  const collateral = {currencyId: ERC20Mapping.decodeEvmAddress(args.collateralAsset), amount: args.liquidatedCollateralAmount}
  const [liquidator, user] = await Promise.all([toAccount(args.liquidator), toAccount(args.user)]);
  const message = `${formatAccount(liquidator)} liquidated ${await formatAsset(collateral)} of ${formatAccount(user)}`;
  broadcast(message);
}

function oracleUpdate({blockNumber}) {
  borrowers.updateAll(blockNumber);
}
