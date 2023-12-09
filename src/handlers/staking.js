import {formatAccount, formatAmount, hdx} from "../currencies.js";
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
  broadcast(`${formatAccount(who, false, emojify(who))} staked **${formatAmount(hdx(stake))}**`);
}

async function unstakeHandler({event: {data: {who, unlockedStake, rewards}}}) {
  broadcast(`${formatAccount(who, false, emojify(who))} unstaked **${formatAmount(hdx(unlockedStake))}** <:cheems:989553853785587723>`);
}

async function rewardsClaimedHandler({event: {data: {who, paidRewards, slashedUnpaidRewards}}}) {
  const percentage = new Intl.NumberFormat('en-US').format((paidRewards / (slashedUnpaidRewards+paidRewards)) * 100);
  const message = `${formatAccount(who, false, emojify(who))} claimed **${formatAmount(hdx(paidRewards))}**`;
  broadcast(message);
}
