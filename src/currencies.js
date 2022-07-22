import {api} from "./api.js";
import dijkstrajs from "dijkstrajs";
import {usdCurrencyId, whaleAmount} from "./config.js";

let currencies = {};

const prices = {};

export const isWhale = amount => amount >= whaleAmount;

export async function loadCurrencies(currencyIds) {
  await Promise.all(currencyIds.map(async id => {
    if (!currencies[id]) {
      const currency = await api().query.assetRegistry.assets(id);
      currencies = {...currencies, [id]: currency};
    }
  }));
}

export const recordPrice = (sold, bought) => {
  const pair = [sold, bought].map(({data}) => data);
  const [a,b] = pair.map(({currencyId}) => currencyId.toNumber());
  if (!prices[a]) {
    prices[a] = {};
  }
  prices[a][b] = pair[0].amount / pair[1].amount;
}

export function usdValue({currencyId, amount}) {
  const price = getPrice(currencyId, usdCurrencyId);
  return price ? amount / price : null;
}

export function getPrice(asset, target) {
  if (prices[asset] && prices[asset][target]) {
    return prices[asset][target];
  }
  try {
    const path = dijkstrajs.find_path(prices, asset, target);
    const swaps = path.map((from, i) => [from, path[i + 1]]).filter(([, to]) => to);
    const price = swaps.reduce((acc, [from, to]) => acc * prices[from][to], 1);
    return price;
  } catch (e) {
    return null;
  }
}

export const formatAccount = (address, whale) => (whale ? '🐋' : '🐍') + `\`${address.toString().substr(-3)}\``;
export const formatAmount = ({amount, currencyId}) => new Intl.NumberFormat('en-US', {maximumSignificantDigits: 4})
  .format(Number(amount) / 10 ** 12) + ' ' + currencies[currencyId].toHuman().name;
export const formatUsdValue = value => value ? ` *~ ${formatAmount({amount: value, currencyId: usdCurrencyId})}*` : '';
