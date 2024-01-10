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

async function unstakeHandler({event}) {
  const {data: {who, unlockedStake}} = event;
  broadcast(`${formatAccount(who, false, emojify(who))} unstaked **${formatAmount(hdx(unlockedStake))}** <:cheems:989553853785587723>`);
}

async function rewardsClaimedHandler({event: {data: {who, paidRewards, unlockedRewards, slashedUnpaidRewards}}}) {
  const totalRewards = Number(paidRewards) + Number(unlockedRewards);
  if (totalRewards > 0) {
    const message = `${formatAccount(who, false, emojify(who))} claimed **${formatAmount(hdx(totalRewards))}** and forfeited **${formatAmount(hdx(slashedUnpaidRewards))}**`;
    broadcast(message);
  }
}
