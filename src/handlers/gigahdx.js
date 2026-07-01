import {formatAccount, formatAmount, hdx} from "../currencies.js";
import {broadcast} from "../discord.js";

// A migration from legacy staking emits BOTH `Staked` and `MigratedFromLegacy`
// in the same extrinsic. Suppress the `Staked` message in that case so migrations
// are only reported once, as a migration.
const notMigration = ({siblings}) => siblings.find(({section, method}) =>
  section === 'gigaHdx' && method === 'MigratedFromLegacy') === undefined;

export default function gigahdxHandler(events) {
  events
    .onFilter('gigaHdx', 'Staked', notMigration, stakedHandler)
    .on('gigaHdx', 'MigratedFromLegacy', migratedHandler)
    .on('gigaHdx', 'Unstaked', unstakedHandler);
}

const GIGAHDX = '<:GIGAHDX:1521826604924272690>';

async function stakedHandler({event: {data: {who, amount}}}) {
  broadcast(`${formatAccount(who)} staked **${formatAmount(hdx(amount))}** as GIGAHDX ${GIGAHDX}`);
}

async function migratedHandler({event: {data: {who, hdxUnlocked}}}) {
  broadcast(`${formatAccount(who)} migrated **${formatAmount(hdx(hdxUnlocked))}** to GIGAHDX ${GIGAHDX}`);
}

async function unstakedHandler({event: {data: {who, payout}}}) {
  broadcast(`${formatAccount(who)} unstaked **${formatAmount(hdx(payout))}** from GIGAHDX :poop:`);
}
