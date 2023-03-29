import {formatAccount, formatAmount} from "../currencies.js";
import {broadcast} from "../discord.js";
import {emojify} from "../utils/emojify.js";

export default function otcHandler(events) {
  events
    .on('otc', 'Placed', placedHandler)
    .on('otc', 'Filled', filledHandler)
    .on('otc', 'PartiallyFilled', filledHandler)
}

async function placedHandler({event, siblings}) {
  const {who} = siblings.find(({method}) => method === 'Reserved').data;
  const {assetIn, assetOut, amountIn, amountOut} = event.data;
  const want = {currencyId: assetIn, amount: amountIn};
  const give = {currencyId: assetOut, amount: amountOut};
  const message = `${formatAccount(who, false, emojify(who))} wants to buy **${formatAmount(want)}** for **${formatAmount(give)}**`
  broadcast(message);
}

async function filledHandler({event, siblings}) {
  const {who} = event.data;
  const [b, a] = siblings
    .slice(0, siblings.indexOf(event))
    .reverse()
    .filter(({method}) => method === 'Transfer')
    .map(({data}) => data);
  const message = `${formatAccount(who, false, emojify(who))} swapped **${formatAmount(a)}** for **${formatAmount(b)}** OTC`;
  broadcast(message);
}
