import {broadcast} from "../discord.js";
import {
  formatAccount,
  formatAmount, formatUsdValue,
  isWhale,
  recordPrice,
  usdValue
} from "../currencies.js";
import {usdCurrencyId} from "../config.js";

export default function xykHandler(events) {
  events.on('xyk', 'SellExecuted', tradesHandler)
    .on('xyk', 'BuyExecuted', tradesHandler)
    .on('xyk', 'LiquidityAdded', liquidityAddedHandler)
    .on('xyk', 'LiquidityRemoved', liquidityRemovedHandler)
}

async function tradesHandler({event, siblings}) {
  const {who, assetIn, assetOut, amount: amountIn, salePrice, buyPrice} = event.data;
  const amountOut = salePrice || buyPrice;
  const sold = {currencyId: assetIn, amount: amountIn};
  const bought = {currencyId: assetOut, amount: amountOut};
  recordPrice(sold, bought);
  const value = usdValue(bought);
  let message = `${formatAccount(who, isWhale(value))} swapped **${formatAmount(sold)}** for **${formatAmount(bought)}**`;
  if (![assetIn, assetOut].includes(usdCurrencyId)) {
    message += formatUsdValue(value);
  }
  broadcast(message);
}

async function liquidityAddedHandler({event}) {
  const {who, assetA, assetB, amountA, amountB} = event.data;
  const a = {amount: amountA, currencyId: assetA};
  const b = {amount: amountB, currencyId: assetB}
  const [va, vb] = [a, b].map(usdValue);
  const value = va && vb ? va + vb : null;
  const message = `💦 liquidity added as **${formatAmount(a)}** + **${formatAmount(b)}**${formatUsdValue(value)} by ${formatAccount(who, isWhale(value))}`;
  broadcast(message);
}

async function liquidityRemovedHandler({event, siblings}) {
  const {who} = event.data;
  const amounts = siblings.filter(({method, data: {to}}) =>
    method === 'Transferred' && to.toString() === who.toString()).map(({data}) => data);
  const [va, vb] = amounts.map(usdValue);
  const value = va && vb ? va + vb : null;
  const message = `🚰 liquidity removed as **${formatAmount(amounts[0])}** + **${formatAmount(amounts[1])}**${formatUsdValue(value)} by ${formatAccount(who, isWhale(value))}`;
  broadcast(message);
}
