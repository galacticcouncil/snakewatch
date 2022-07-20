import {api} from '../api.js';
import {broadcast} from "../discord.js";

export default function xykHandler(events) {
  events.on('xyk', 'SellExecuted', tradesHandler)
    .on('xyk', 'BuyExecuted', tradesHandler)
}

async function tradesHandler({event, siblings}) {
  const {who} = event.data;
  const sold = siblings.find(({method, data: {from}}) =>
    method === 'Transferred' && from.toString() === who.toString());
  const bought = siblings.find(({method, data: {to}}) =>
    method === 'Transferred' && to.toString() === who.toString());
  await Promise.all([sold, bought].map(({data: {currencyId}}) => loadCurrency(currencyId)));
  const message = `${formatAddress(who)} swapped ${formatAmount(sold.data)} for ${formatAmount(bought.data)}`;
  broadcast(message);
}

let currencies = {};

async function loadCurrency(currencyId) {
  if (!currencies[currencyId]) {
    const currency = await api().query.assetRegistry.assets(currencyId);
    currencies = {...currencies, [currencyId]: currency};
  }
}

const formatAddress = address => `🐍${address.toString().substr(-3)}`;
const formatAmount = ({amount, currencyId}) => new Intl.NumberFormat('en-US', { maximumSignificantDigits: 4 })
    .format(Number(amount) / 10**12) + ' ' + currencies[currencyId].toHuman().name;
