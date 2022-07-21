import {broadcast} from "../discord.js";
import {formatAccount, formatAmount, loadCurrencies, recordPrice, usdCurrencyId, usdValue} from "../currencies.js";

export default function xykHandler(events) {
  events.on('xyk', 'SellExecuted', tradesHandler)
    .on('xyk', 'BuyExecuted', tradesHandler)
    .on('xyk', 'LiquidityAdded', liquidityAddedHandler)
    .on('xyk', 'LiquidityRemoved', liquidityRemovedHandler)
}

async function tradesHandler({event, siblings}) {
  const {who} = event.data;
  const sold = siblings.find(({method, data: {from}}) =>
    method === 'Transferred' && from.toString() === who.toString());
  const bought = siblings.find(({method, data: {to}}) =>
    method === 'Transferred' && to.toString() === who.toString());
  await loadCurrencies([sold, bought].map(({data: {currencyId}}) => currencyId));
  recordPrice(sold, bought);
  const value = usdValue(sold.data);
  const whale = value >= 10**12;
  let message = `${formatAccount(who, whale)} swapped **${formatAmount(sold.data)}** for **${formatAmount(bought.data)}**`;
  message += formatUsdValue(value);
  broadcast(message);
}

async function liquidityAddedHandler({event}) {
  const {who, assetA, assetB, amountA, amountB} = event.data;
  await loadCurrencies([assetA, assetB]);
  const message = `💦 liquidity added as **${formatAmount({
    amount: amountA,
    currencyId: assetA
  })}** + **${formatAmount({amount: amountB, currencyId: assetB})}** by ${formatAccount(who)}`;
  broadcast(message);
}

async function liquidityRemovedHandler({event, siblings}) {
  const {who, assetA, assetB} = event.data;
  await loadCurrencies([assetA, assetB]);
  const amounts = siblings.filter(({method, data: {to}}) =>
    method === 'Transferred' && to.toString() === who.toString()).map(({data}) => data);
  const message = `🚰 liquidity removed as **${formatAmount(amounts[0])}** + **${formatAmount(amounts[1])}** by ${formatAccount(who)}`;
  broadcast(message);
}

function formatUsdValue(value) {
  return value ? ` (~${formatAmount({amount: value, currencyId: usdCurrencyId})})` : '';
}
