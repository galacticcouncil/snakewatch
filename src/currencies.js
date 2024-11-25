import {api} from "./api.js";
import dijkstrajs from "dijkstrajs";
import {usdCurrencyId, whaleAmount} from "./config.js";
import {fromAccount} from "./utils/evm.js";
import {emojify} from "./utils/emojify.js";
import {metadata} from "./utils/assethub.js";

let currencies = {};
const prices = {};

export const isWhale = amount => amount >= whaleAmount;

export function currenciesHandler(events) {
  events
    .onSection('currencies', ({event: {data: {currencyId}}}) => currencyId && loadCurrency([currencyId]))
    .onSection('tokens', ({event: {data: {currencyId}}}) => currencyId && loadCurrency([currencyId]))
    .on('otc', 'Placed', ({event: {data: {assetIn}}}) => assetIn && loadCurrency(assetIn))
}

async function loadCurrency(id) {
  if (!currencies[id]) {
    let currency = (await api().query.assetRegistry.assets(id)).toHuman();
    if (api().query.assetRegistry.assetMetadataMap) {
      const metadata = await api().query.assetRegistry.assetMetadataMap(id);
      currency = {...currency, ...metadata.toHuman()};
    }
    if (currency.assetType === 'Bond') {
      const bond = await api().query.bonds.bonds(id);
      const [parent, maturity] = bond.toHuman();
      currency = {...currency, parent, maturity};
    }
    if (currency.assetType === 'External') {
      const location = (await api().query.assetRegistry.assetLocations(id)).toJSON();
      const ahId = location?.interior?.x3[2]?.generalIndex;
      if (ahId) {
        const meta = await metadata(ahId);
        currency = {...currency, ...meta?.toHuman()};
      }
    }
    currencies = {...currencies, [id]: currency};
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

export const hdx = amount => ({currencyId: 0, amount});

export const symbol = currencyId => {
  const currency = currencies[currencyId];
  if (currency.assetType === 'Bond') {
    return Number(currencyId) === 1000010 ? 'HDXb₁' :
           Number(currencyId) === 1000013 ? 'HDXb₂' :
           symbol(currency.parent) + 'b';
  }
  return currency.symbol || currency.name || (Number(currencyId) === 0 ? 'HDX' : currencyId);
}
export const decimals = currencyId => {
  const currency = currencies[currencyId];
  if (currency.assetType === 'StableSwap') return 18;
  if (currency.parent) return decimals(currency.parent);
  return currency.decimals || 1;
}

const short = address => "`" + (fromAccount(address.toString()) || address.toString()).substr(-3) + "`";
const url = (prefix, address) => `[${short(address)}](${prefix}/${address})`;
const maybeUrl = address => {
  const explorer = process.env.EXPLORER;
  return explorer ? url(explorer, address) : short(address);
}
export const icon = address => currencies[0]?.symbol === 'HDX' ? emojify(address) : `🐍`;
export const formatAccount = (address, whale) => (whale ? '🐋' : icon(address)) + `${maybeUrl(address)}`;
export const formatAmount = ({amount, currencyId}) => new Intl.NumberFormat('en-US', {maximumSignificantDigits: 4})
  .format(Number(amount) / 10 ** decimals(currencyId)).replace(/,/g, " ") + ' ' + symbol(currencyId);
export const formatUsdValue = value => {
  if (!value) {
    return '';
  }
  let amount = Number(value) / 10 ** (currencies[usdCurrencyId].decimals || 12);
  amount = amount > 1 ? Math.round(amount) : amount;
  const symbol = currencies[usdCurrencyId].symbol || currencies[usdCurrencyId].name || 'USD';
  return ` *~ ${new Intl.NumberFormat('en-US', {maximumSignificantDigits: amount < 1 ? 1 : 4, maximumFractionDigits: 2}).format(amount).replace(/,/g, " ")} ${symbol}*`;
};
export const formatAsset = asset => `**${formatAmount(asset)}**${formatUsdValue(usdValue(asset))}`;
