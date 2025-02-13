import process from 'node:process';
import {broadcast} from "../discord.js";
import {formatAmount, formatUsdValue, usdValue} from "../currencies.js";

export default function referralsHandler(events) {
  events
    .onFilter('balances', 'Transfer', ({event: {data: {to}}}) => to.toString() === referralPot, transferHandler)
}

const referralPot = '7L53bUTCCAvmCxhe15maHwJZbjQYH89LkXuyTnTi1J58xyFC';

export const notByReferralPot = ({event: {data: {who}}}) => who.toString() !== referralPot;

const window = 150;
let accrued = 0;
let since = null;

async function transferHandler({event: {data: {amount}}, blockNumber})  {
  if (since === null) {
    since = blockNumber;
  }
  accrued += Number(amount);
  if (blockNumber - since > window) {
    await report();
    accrued = 0;
    since = blockNumber;
  }
}

async function report() {
  if (accrued > 0) {
    const amount = {amount: accrued, currencyId: 0};
    const value = await usdValue(amount);
    const message = `💸 **${formatAmount(amount)}**${formatUsdValue(value)} bought for rewards`;
    broadcast(message);
  }
}

['SIGHUP', 'SIGINT', 'SIGQUIT', 'SIGILL', 'SIGTRAP', 'SIGABRT',
  'SIGBUS', 'SIGFPE', 'SIGUSR1', 'SIGSEGV', 'SIGUSR2', 'SIGTERM'
].forEach(sig =>
  process.on(sig, async () => {
    await report();
    setTimeout(() => process.exit(0), 500);
  }));

