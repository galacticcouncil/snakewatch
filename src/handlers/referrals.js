import process from 'node:process';
import {broadcast} from "../discord.js";
import {formatAmount, formatUsdValue, usdValue} from "../currencies.js";
import {isSameAccount} from "../utils/emojify.js";

export default function referralsHandler(events) {
  events
    .onFilter('balances', 'Transfer', ({event: {data: {to}}}) => isRewardPot(to.toString()), transferHandler)
}

const rewardPots = [
  '7L53bUTCCAvmCxhe15maHwJZbjQYH89LkXuyTnTi1J58xyFC',
  '13UVJyLkaPAE2HDTAaSadmwptPVwzY621KiKZ1ZrKYaXga2w',
  // pallet_fee_processor's GigaHdxFeeReceiver (15% of trade fees) -> pallet_gigahdx::gigapot_account_id()
  '12BMz7GAi6ZCN8JiDQ6u7gPX5i71LmVT3vY3qd2ieXvTLAxa',
  // pallet_fee_processor's GigaHdxRewardsFeeReceiver (25% of trade fees) -> pallet_gigahdx_rewards::reward_accumulator_pot()
  '167K5HduwPxdgUk2TYTvzAJf4QETArrLz11uT4L6rCAMAkBi',
];

const isRewardPot = address => rewardPots.some(pot => isSameAccount(address, pot));

export const notByRewardPot = ({event: {data: {who}}}) => !isRewardPot(who.toString());

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

