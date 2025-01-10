import {swapHandler} from "./xyk.js";
import {formatAccount, formatAmount, formatUsdValue, isWhale, usdValue} from "../currencies.js";
import {broadcast} from "../discord.js";
import {usdCurrencyId} from "../config.js";
import {notInRouter} from "./router.js";
import {notByReferralPot} from "./referrals.js";

export default function omnipoolHandler(events) {
  events
    .onFilter('omnipool', 'SellExecuted', e => notInRouter(e) && notByReferralPot(e), sellHandler)
    .onFilter('omnipool', 'BuyExecuted', notInRouter, buyHandler)
    .on('omnipool', 'LiquidityAdded', liquidityAddedHandler)
    .on('omnipool', 'LiquidityRemoved', liquidityRemovedHandler);
}

export async function sellHandler({event}) {
  const {who, assetIn, assetOut, amountIn, amountOut} = event.data;
  return swapHandler({who, assetIn, assetOut, amountIn, amountOut});
}

export async function buyHandler({event}) {
  const {who, assetIn, assetOut, amountIn, amountOut} = event.data;
  return swapHandler({who, assetIn, assetOut, amountIn, amountOut});
}

async function liquidityAddedHandler({event}) {
  const {who, assetId: currencyId, amount} = event.data;
  const added = {currencyId, amount};
  const value = currencyId.toString() !== usdCurrencyId ? await usdValue(added) : null;
  const message = `💦 omnipool hydrated with **${formatAmount(added)}**${formatUsdValue(value)} by ${formatAccount(who, isWhale(value))}`;
  broadcast(message);
}

async function liquidityRemovedHandler({event, siblings}) {
  const {who, assetId: currencyId} = event.data;
  const transfers = siblings
    .slice(0, siblings.indexOf(event))
    .reverse()
    .filter(({method, data: {to}}) => method === 'Transferred' && to.toString() === who.toString());
  let asset = transfers[0].data;
  let lrna = '';
  if (asset.currencyId.toNumber() === 1) {
    lrna = ' + ' + formatAmount(asset);
    asset = transfers[1].data;
  }
  const value = currencyId.toString() !== usdCurrencyId ? await usdValue(asset) : null;
  const message = `🚰 omnipool dehydrated of **${formatAmount(asset)}**${formatUsdValue(value)}${lrna} by ${formatAccount(who, isWhale(value))}`;
  broadcast(message);
}
