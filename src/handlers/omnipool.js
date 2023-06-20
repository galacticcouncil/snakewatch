import {swapHandler} from "./xyk.js";
import {formatAccount, formatAmount, formatUsdValue, isWhale, usdValue} from "../currencies.js";
import {broadcast} from "../discord.js";
import {usdCurrencyId} from "../config.js";
import {emojify} from "../utils/emojify.js";
import {notInDca} from "./dca.js";

export default function omnipoolHandler(events) {
  events
    .onFilter('omnipool', 'SellExecuted', notInDca, sellHandler)
    .onFilter('omnipool', 'BuyExecuted', notInDca, buyHandler)
    .on('omnipool', 'LiquidityAdded', liquidityAddedHandler)
    .on('omnipool', 'LiquidityRemoved', liquidityRemovedHandler);
}

async function sellHandler({event}) {
  const {who, assetIn, assetOut, amountIn, amountOut} = event.data;
  return swapHandler({who, assetIn, assetOut, amountIn, amountOut}, emojify(who));
}

async function buyHandler({event}) {
  const {who, assetIn, assetOut, amountIn, amountOut} = event.data;
  return swapHandler({who, assetIn, assetOut, amountIn, amountOut}, emojify(who));
}

async function liquidityAddedHandler({event}) {
  const {who, assetId: currencyId, amount} = event.data;
  const added = {currencyId, amount};
  const value = currencyId.toString() !== usdCurrencyId ? usdValue(added) : null;
  const message = `💦 omnipool hydrated with **${formatAmount(added)}**${formatUsdValue(value)} by ${formatAccount(who, isWhale(value), emojify(who))}`;
  broadcast(message);
}

async function liquidityRemovedHandler({event, siblings}) {
  const {who, assetId: currencyId} = event.data;
  const {data: removed} = siblings.find(({method, data: {to}}) => method === 'Transferred' && to.toString() === who.toString());
  const value = currencyId.toString() !== usdCurrencyId ? usdValue(removed) : null;
  const message = `🚰 omnipool dehydrated of **${formatAmount(removed)}**${formatUsdValue(value)} by ${formatAccount(who, isWhale(value), emojify(who))}`;
  broadcast(message);
}