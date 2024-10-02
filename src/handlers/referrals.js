import process from 'node:process';
import {broadcast} from "../discord.js";
import {formatAmount, formatUsdValue, usdValue} from "../currencies.js";

export default function referralsHandler(events) {
  events
    .onFilter('balances', 'Transfer', ({event: {data: {to}}}) => to.toString() === referralPot, transferHandler)
}

const referralPot = '7L53bUTCCAvmCxhe15maHwJZbjQYH89LkXuyTnTi1J58xyFC';

export const notByReferralPot = ({event: {data: {who}}}) => who.toString() !== referralPot;

// Define different windows
const windows = [150, 7200, 15000];
const accruedAmounts = {};
let since = null;

async function transferHandler({event: {data: {amount}}, blockNumber})  {
 windows.forEach(window => {
    if (accruedAmounts[window] === undefined) {
      accruedAmounts[window] = {
        accrued: 0,
        since: blockNumber,
      };
    }

    accruedAmounts[window].accrued += Number(amount);

    if (blockNumber - accruedAmounts[window].since > window) {
      report(window);
      accruedAmounts[window].accrued = 0;
      accruedAmounts[window].since = blockNumber;
    }
  });
}

function report(window) {
  const { accrued, since } = accruedAmounts[window];

  if (accrued > 0) {
    const amount = { amount: accrued, currencyId: 0 };
    const value = usdValue(amount);
    const message = `💸 **${formatAmount(amount)}**${formatUsdValue(value)} bought for rewards (Window: ${window} blocks)`;
    broadcast(message);
  }
}

['SIGHUP', 'SIGINT', 'SIGQUIT', 'SIGILL', 'SIGTRAP', 'SIGABRT',
  'SIGBUS', 'SIGFPE', 'SIGUSR1', 'SIGSEGV', 'SIGUSR2', 'SIGTERM'
].forEach(sig =>
  process.on(sig, () => {
    windows.forEach(window => report(window));
    setTimeout(() => process.exit(0), 500);
  }));

