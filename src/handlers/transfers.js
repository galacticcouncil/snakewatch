import {formatAccount, formatAmount, formatUsdValue, isWhale, usdValue} from "../currencies.js";
import {broadcast} from "../discord.js";

export default function transfersHandler(events) {
  events.onFilter(
    'currencies',
    'Transferred',
    ({siblings}) => siblings.find(({section}) => section === 'xyk') === undefined,
    transferredHandler
  );
}

async function transferredHandler({event}) {
  const {from, to} = event.data;
  const value = usdValue(event.data);
  if (isWhale(value)) {
    const message = `${formatAccount(from, true)} transferred **${formatAmount(event.data)}** ${formatUsdValue(value)} to ${formatAccount(to, true)} @here`;
    broadcast(message);
  }
}
