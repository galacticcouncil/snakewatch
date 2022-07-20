import {api} from '../api.js';
import {broadcast} from "../discord.js";

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
  const message = `${formatAccount(who)} swapped ${formatAmount(sold.data)} for ${formatAmount(bought.data)}`;
  broadcast(message);
}

async function liquidityAddedHandler({event}) {
  const {who, assetA, assetB, amountA, amountB} = event.data;
  await loadCurrencies([assetA, assetB]);
  const message = `💦 liquidity added as ${formatAmount({
    amount: amountA,
    currencyId: assetA
  })} + ${formatAmount({amount: amountB, currencyId: assetB})} by ${formatAccount(who)}`;
  broadcast(message);
}

async function liquidityRemovedHandler({event, siblings}) {
  const {who, assetA, assetB} = event.data;
  await loadCurrencies([assetA, assetB]);
  const amounts = siblings.filter(({method, data: {to}}) =>
    method === 'Transferred' && to.toString() === who.toString()).map(({data}) => data);
  const message = `🚰 liquidity removed as ${formatAmount(amounts[0])} + ${formatAmount(amounts[1])} by ${formatAccount(who)}`;
  broadcast(message);
}

let currencies = {};

async function loadCurrencies(currencyIds) {
  await Promise.all(currencyIds.map(async id => {
    if (!currencies[id]) {
      const currency = await api().query.assetRegistry.assets(id);
      currencies = {...currencies, [id]: currency};
    }
  }));
}

const formatAccount = address => `🐍${address.toString().substr(-3)}`;
const formatAmount = ({amount, currencyId}) => new Intl.NumberFormat('en-US', {maximumSignificantDigits: 4})
  .format(Number(amount) / 10 ** 12) + ' ' + currencies[currencyId].toHuman().name;
