import {formatAccount, formatAmount, formatUsdValue, isWhale, loadCurrencies, usdValue} from "../currencies.js";
import {broadcast} from "../discord.js";

export default function transfersHandler(events) {
  events.on('currencies', 'Transferred', transferredHandler);
}

async function transferredHandler({event, siblings}) {
  if (siblings.filter(({section}) => section === 'xyk').length > 0) {
    return;
  }
  const {from, to, currencyId} = event.data;
  await loadCurrencies([currencyId]);
  const value = usdValue(event.data);
  if (isWhale(value)) {
    const message = `${formatAccount(from, true)} transferred **${formatAmount(event.data)}** ${formatUsdValue(value)} to ${formatAccount(to, true)} @here`;
    broadcast(message);
  }
}
