import {broadcast} from "../discord.js";
import {
  formatAccount,
  formatAmount, formatUsdValue,
  isWhale,
  recordPrice,
  usdValue
} from "../currencies.js";
import {usdCurrencyId} from "../config.js";
import {notInRouter} from "./router.js";

export default function xykHandler(events) {
  events
    .onFilter('xyk', 'SellExecuted', notInRouter, sellHandler)
    .onFilter('xyk', 'BuyExecuted', notInRouter, buyHandler)
    .on('xyk', 'LiquidityAdded', liquidityAddedHandler)
    .on('xyk', 'LiquidityRemoved', liquidityRemovedHandler)
}

async function sellHandler({event}) {
  const {who, assetIn, assetOut, amount: amountIn, salePrice: amountOut} = event.data;
  return swapHandler({who, assetIn, assetOut, amountIn, amountOut});
}

async function buyHandler({event}) {
  const {who, assetIn, assetOut, amount: amountOut, buyPrice: amountIn} = event.data;
  return swapHandler({who, assetIn, assetOut, amountIn, amountOut});
}

export async function swapHandler({who, assetIn, assetOut, amountIn, amountOut}, action = `swapped`) {
  const sold = {currencyId: assetIn, amount: amountIn};
  const bought = {currencyId: assetOut, amount: amountOut};
  recordPrice(sold, bought);
  const value = await usdValue(bought);
  let message = `${formatAccount(who, isWhale(value))} ${action} **${formatAmount(sold)}** for **${formatAmount(bought)}**`;
  if (![assetIn, assetOut].map(id => id.toString()).includes(usdCurrencyId)) {
    message += formatUsdValue(value);
  }
  broadcast(message);
}

async function liquidityAddedHandler({event}) {
  const {who, assetA, assetB, amountA, amountB} = event.data;
  const a = {amount: amountA, currencyId: assetA};
  const b = {amount: amountB, currencyId: assetB};
  const [va, vb] = await Promise.all([a, b].map(usdValue));
  const value = va && vb ? va + vb : null;
  const message = `💦 liquidity added as **${formatAmount(a)}** + **${formatAmount(b)}**${formatUsdValue(value)} by ${formatAccount(who, isWhale(value))}`;
  broadcast(message);
}

async function liquidityRemovedHandler({event, siblings}) {
  const {who} = event.data;
  const amounts = siblings.filter(({method, data: {to}}) =>
    method === 'Transferred' && to.toString() === who.toString()).map(({data}) => data);
  const message = `🚰 liquidity removed as **${formatAmount(amounts[0])}** + **${formatAmount(amounts[1])}** by ${formatAccount(who)}`;
  broadcast(message);
}
