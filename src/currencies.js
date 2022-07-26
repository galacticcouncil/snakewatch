import {api} from "./api.js";
import dijkstrajs from "dijkstrajs";
import {usdCurrencyId, whaleAmount} from "./config.js";

let currencies = {};

const prices = {};

export const isWhale = amount => amount >= whaleAmount;

export function currenciesHandler(events) {
  events.onSection('currencies', ({event: {data: {currencyId}}}) => currencyId && loadCurrency([currencyId]))
}

async function loadCurrency(id) {
  if (!currencies[id]) {
    const [asset, metadata] = await Promise.all([
      api().query.assetRegistry.assets(id),
      api().query.assetRegistry.assetMetadataMap(id)
    ]);
    currencies = {...currencies, [id]: {...asset.toHuman(), ...metadata.toHuman()}};
  }
}

export const recordPrice = (sold, bought) => {
  const pair = [sold, bought];
  const [a, b] = pair.map(({currencyId}) => currencyId.toNumber());
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

export const formatAccount = (address, whale, icon = `🐍`) => (whale ? '🐋' : icon) + `\`${address.toString().substr(-3)}\``;
export const formatAmount = ({amount, currencyId}) => new Intl.NumberFormat('en-US', {maximumSignificantDigits: 4})
  .format(Number(amount) / 10 ** (currencies[currencyId].decimals || 12)).replace(/,/g, " ")
  + ' ' + (currencies[currencyId].symbol || currencies[currencyId].name);
export const formatUsdValue = value => value ? ` *~ ${formatAmount({amount: value, currencyId: usdCurrencyId})}*` : '';
