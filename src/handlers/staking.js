import {formatAccount, formatAmount, hdx} from "../currencies.js";
import {broadcast} from "../discord.js";

export default function stakingHandler(events) {
  events
    .on('staking', 'PositionCreated', stakeHandler)
    .on('staking', 'StakeAdded', stakeHandler)
    .on('staking', 'RewardsClaimed', rewardsClaimedHandler)
    .on('staking', 'Unstaked', unstakeHandler)
    .on('gigaHdx', 'Staked', gigaStakedHandler)
    .on('gigaHdx', 'Unstaked', gigaUnstakedHandler)
    .on('gigaHdx', 'Unlocked', gigaUnlockedHandler)
    .on('gigaHdx', 'UnstakeCancelled', gigaUnstakeCancelledHandler)
    .on('gigaHdx', 'MigratedFromLegacy', gigaMigratedHandler)
    .on('gigaHdx', 'PoolContractUpdated', gigaPoolContractUpdatedHandler)
    .on('gigaHdxRewards', 'RewardsClaimed', gigaRewardsClaimedHandler);
}

async function stakeHandler({event: {data: {who, stake}}}) {
  broadcast(`${formatAccount(who)} staked **${formatAmount(hdx(stake))}**`);
}

async function unstakeHandler({event}) {
  const {data: {who, unlockedStake}} = event;
  broadcast(`${formatAccount(who)} unstaked **${formatAmount(hdx(unlockedStake))}** <:cheems:989553853785587723>`);
}

async function rewardsClaimedHandler({event: {data: {who, paidRewards, unlockedRewards, slashedUnpaidRewards}}}) {
  const totalRewards = Number(paidRewards) + Number(unlockedRewards);
  if (totalRewards > 0) {
    const message = `${formatAccount(who)} claimed **${formatAmount(hdx(totalRewards))}** and forfeited **${formatAmount(hdx(slashedUnpaidRewards))}**`;
    broadcast(message);
  }
}

async function gigaStakedHandler({event: {data: {who, amount}}}) {
  broadcast(`${formatAccount(who)} staked **${formatAmount(hdx(amount))}** into GIGAHDX`);
}

async function gigaUnstakedHandler({event: {data: {who, payout, expiresAt}}, blockNumber}) {
  const blocksRemaining = expiresAt.toNumber() - blockNumber;
  broadcast(`${formatAccount(who)} started unstaking **${formatAmount(hdx(payout))}** from GIGAHDX, unlocks at block #${expiresAt} (~${blocksRemaining} blocks)`);
}

async function gigaUnlockedHandler({event: {data: {who, amount}}}) {
  broadcast(`${formatAccount(who)} unstaked **${formatAmount(hdx(amount))}** from GIGAHDX <:cheems:989553853785587723>`);
}

async function gigaUnstakeCancelledHandler({event: {data: {who, amount}}}) {
  broadcast(`${formatAccount(who)} cancelled unstaking **${formatAmount(hdx(amount))}** and restaked it in GIGAHDX`);
}

async function gigaMigratedHandler({event: {data: {who, hdxUnlocked}}}) {
  broadcast(`${formatAccount(who)} migrated **${formatAmount(hdx(hdxUnlocked))}** from legacy staking into GIGAHDX`);
}

async function gigaPoolContractUpdatedHandler({event: {data: {contract}}}) {
  broadcast(`⚠️ GIGAHDX pool contract updated to \`${contract}\``);
}

async function gigaRewardsClaimedHandler({event: {data: {who, totalHdx}}}) {
  if (Number(totalHdx) > 0) {
    broadcast(`${formatAccount(who)} claimed **${formatAmount(hdx(totalHdx))}** governance rewards into GIGAHDX`);
  }
}
