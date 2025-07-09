import {formatAccount, formatAsset, symbol} from "../currencies.js";
import {broadcast} from "../discord.js";
import poolAbi from "../resources/aave-pool.abi.js";
import oracleAbi from "../resources/dia-oracle.abi.js";
import ERC20Mapping from "../utils/erc20mapping.js";
import {toAccount} from "../utils/evm.js";
import Borrowers from "../utils/borrowers.js";
import {notInRouter} from "./router.js";
import ethers from "ethers";

const borrowers = new Borrowers();

export default function borrowingHandler(events) {
  borrowers.init();
  events
    .onLog('Supply', poolAbi, borrowers.handler(supply), notInRouter)
    .onLog('Withdraw', poolAbi, borrowers.handler(withdraw), notInRouter)
    .onLog('Borrow', poolAbi, borrowers.handler(borrow))
    .onLog('Repay', poolAbi, borrowers.handler(repay))
    .onLog('LiquidationCall', poolAbi, borrowers.handler(liquidationCall))
    .onLog('ReserveDataUpdated', poolAbi, reserveDataUpdated)
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

async function reserveDataUpdated({log: {args: {reserve, liquidityRate, stableBorrowRate, variableBorrowRate}}}) {
  const currencyId = ERC20Mapping.decodeEvmAddress(reserve);
  const reserveSymbol = symbol(currencyId);
  
  if (reserveSymbol) {
    const supplyRate = Number(ethers.utils.formatUnits(liquidityRate, 27));
    const borrowRate = Number(ethers.utils.formatUnits(variableBorrowRate, 27));
    
    await borrowers.alerts.checkInterestRate(reserveSymbol, 'supply', supplyRate);
    await borrowers.alerts.checkInterestRate(reserveSymbol, 'borrow', borrowRate);
  }
}

function oracleUpdate({blockNumber}) {
  borrowers.updateAll(blockNumber);
}
