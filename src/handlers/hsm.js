import {isSameAccount} from "../utils/emojify.js";
import {broadcast} from "../discord.js";
import {formatAccount, formatAmount, isWhale, recordPrice} from "../currencies.js";


export default function hsmHandler(events) {
  events.onFilter('stableswap', 'BuyExecuted', isHsm, buyHandler);
}

export const account = '12ZuLmUEvgp1nqnweRUfKetM1AFvkcaTgu5Ujdxj8nh2W5mA'

export function isHsm({event}) {
  const {who} = event.data;
  return isSameAccount(who, account);
}

let buyAggregates = [];
let reportTimeout = null;

export function submitReport() {
  if (buyAggregates.length > 0) {
    // Aggregate by assetIn
    const aggregated = buyAggregates.reduce((acc, tx) => {
      const key = tx.assetIn;
      if (!acc[key]) acc[key] = 0;
      acc[key] += Number(tx.amountIn);
      return acc;
    }, {});

    const totalAmountOut = buyAggregates.reduce((sum, tx) => sum + Number(tx.amountOut), 0);
    const assetOut = buyAggregates[0].assetOut;
    const who = buyAggregates[0].who;
    const count = buyAggregates.length;

    const action = count === 1 ? 'swapped' : `split over ${count} swaps`;

    // Format multiple assets with " + "
    const assetsStr = Object.entries(aggregated)
      .map(([assetIn, amountIn]) => formatAmount({currencyId: assetIn, amount: amountIn}))
      .join(' + ');

    const bought = {currencyId: assetOut, amount: totalAmountOut};
    const message = `${formatAccount(who, false)} ${action} **${assetsStr}** for **${formatAmount(bought)}**`;

    broadcast(message);
    buyAggregates = [];
  }
  reportTimeout = null;
}

function scheduleReport() {
  if (!reportTimeout) {
    reportTimeout = setTimeout(submitReport, 60 * 1000);
  }
}

// Wrap the original buyHandler to aggregate buys
function buyHandler({event}) {
  const {who, assetIn, assetOut, amountIn, amountOut} = event.data;
  buyAggregates.push({who, assetIn, assetOut, amountIn, amountOut, timestamp: Date.now()});
  scheduleReport();
}

