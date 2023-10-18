import {swapHandler} from "./xyk.js";
import {sellHandler, buyHandler} from "./omnipool.js";
import {formatAccount, formatAmount, formatUsdValue, isWhale, usdValue} from "../currencies.js";
import {broadcast} from "../discord.js";
import {emojify} from "../utils/emojify.js";
import {notInDca} from "./dca.js";

export default function stableswapHandler(events) {
  events
    .onFilter('stableswap', 'SellExecuted', notInDca, sellHandler)
    .onFilter('stableswap', 'BuyExecuted', notInDca, buyHandler)
    .onFilter('stableswap', 'LiquidityAdded', notInDca, liquidityAddedHandler)
    .onFilter('stableswap', 'LiquidityRemoved', notInDca, liquidityRemovedHandler);
}

async function liquidityAddedHandler({event: {data: {who, poolId, shares, assets}}}) {
  const share = {currencyId: poolId, amount: shares};
  if (assets.length > 1) {
    const value = usdValue(share);
    const message = `💦 pool hydrated for **${formatAmount(share)}**${formatUsdValue(value)} shares by ${formatAccount(who, isWhale(value), emojify(who))}`
    broadcast(message);
  } else {
    const [{amount, assetId}] = assets;
    return swapHandler({who, assetIn: assetId, assetOut: poolId, amountIn: amount, amountOut: shares}, emojify(who));
  }
}

async function liquidityRemovedHandler({event: {data: {who, poolId, shares, amounts}}}) {
  const share = {currencyId: poolId, amount: shares};
  if (amounts.length > 1) {
    const value = usdValue(share);
    const message = `🚰 pool dehydrated for **${formatAmount(share)}**${formatUsdValue(value)} shares by ${formatAccount(who, isWhale(value), emojify(who))}`
    broadcast(message);
  } else {
    const [{amount, assetId}] = amounts;
    return swapHandler({who, assetIn: poolId, assetOut: assetId, amountIn: shares, amountOut: amount}, emojify(who));
  }
}
