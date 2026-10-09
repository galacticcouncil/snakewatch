import {formatAccount, formatAmount} from "../currencies.js";
import {broadcast} from "../discord.js";

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
  const message = `${formatAccount(who)} wants to buy **${formatAmount(want)}** for **${formatAmount(give)}**`
  broadcast(message);
}

async function filledHandler({event, siblings}) {
  const {who} = event.data;
  const whoStr = who.toString();
  // currencies.Transferred is emitted for every leg regardless of asset type
  // (native, tokens, ERC20); tokens.Transfer / balances.Transfer are not, so an
  // ERC20 leg (HOLLAR, HYPE, ...) would otherwise never be found.
  const [b, a] = siblings
    .slice(0, siblings.indexOf(event))
    .reverse()
    .filter(({section, method, data}) => section === 'currencies' && method === 'Transferred'
      && (data.from?.toString() === whoStr || data.to?.toString() === whoStr))
    .map(({data}) => data);
  if (!a || !b) {
    console.warn('otc filled: could not find both swap legs for', whoStr);
    return;
  }
  const message = `${formatAccount(who)} swapped **${formatAmount(a)}** for **${formatAmount(b)}** OTC`;
  broadcast(message);
}
