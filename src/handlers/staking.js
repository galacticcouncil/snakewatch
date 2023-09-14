import {formatAccount, formatAmount} from "../currencies.js";
import {broadcast} from "../discord.js";
import {emojify} from "../utils/emojify.js";

export default function stakingHandler(events) {
  events
    .on('staking', 'PositionCreated', stakeHandler)
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
