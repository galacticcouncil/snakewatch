import {formatAccount, formatAmount} from "../currencies.js";
import {broadcast} from "../discord.js";
import {emojify} from "../utils/emojify.js";

export default function stakingHandler(events) {
  events
    .on('staking', 'PositionCreated', stakeHandler)
    .on('staking', 'StakeAdded', stakeHandler)
    .on('staking', 'RewardsClaimed', rewardsClaimedHandler)
    .on('staking', 'Unstaked', unstakeHandler);
}

async function stakeHandler({event: {data: {who, stake}}}) {
  const amount = {currencyId: 0, amount: stake};
  const message = `${formatAccount(who, false, emojify(who))} staked **${formatAmount(amount)}**`;
  broadcast(message);
}

async function unstakeHandler({event: {data: {who, unlockedStake}}}) {
  const amount = {currencyId: 0, amount: unlockedStake};
  const message = `${formatAccount(who, false, emojify(who))} unstaked **${formatAmount(amount)}** <:cheems:989553853785587723>`;
  broadcast(message);
}

async function rewardsClaimedHandler({event: {data: {who, paidRewards, slashedUnpaidRewards}}}) {
  const amount = {currencyId: 0, amount: paidRewards};
  const percentage = new Intl.NumberFormat('en-US').format((paidRewards / (slashedUnpaidRewards+paidRewards)) * 100);
  const message = `${formatAccount(who, false, emojify(who))} claimed **${formatAmount(amount)}** (${percentage}% of allocated reward)`;
  broadcast(message);
}
