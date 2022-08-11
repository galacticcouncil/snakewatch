import {formatAccount, formatAmount, formatUsdValue, isWhale, usdValue} from "../currencies.js";
import {broadcast} from "../discord.js";

export default function transfersHandler(events) {
  events.onFilter(
    'currencies',
    'Transferred',
    ({siblings}) => siblings.find(({section}) => section === 'xyk') === undefined,
    transferredHandler
  );
  events.onFilter(
    'balances',
    'Transfer',
    ({siblings}) => siblings.find(({section, method}) =>
      section === 'currencies' && method === 'Transferred') === undefined,
    balancesTransferHandler
  );
}

async function transferredHandler({event}) {
  const {from, to} = event.data;
  const value = usdValue(event.data);
  if (isWhale(value)) {
    const message = `${formatAccount(from, true)} transferred **${formatAmount(event.data)}**${formatUsdValue(value)} to ${formatAccount(to, true)} @here`;
    broadcast(message);
  }
}

async function balancesTransferHandler({event}) {
  event.data.currencyId = '0';
  return transferredHandler({event});
}
