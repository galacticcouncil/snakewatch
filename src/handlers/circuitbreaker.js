import {broadcast} from "../discord.js";
import {formatAmount} from "../currencies.js";
import {getAlerts} from "../utils/alerts.js";

export default function circuitBreakerHandler(events) {
  events.on('circuitBreaker', 'AssetLockdown', assetLockdownHandler);
}

async function assetLockdownHandler({event, blockNumber}) {
  const {assetId, until} = event.data;
  const blocksRemaining = until.toNumber() - blockNumber;

  const asset = {currencyId: assetId, amount: 0};
  const message = `🔒 **Circuit Breaker Triggered**: Asset **${formatAmount(asset).split(' ')[0]}** locked until block #${until} (~${blocksRemaining} blocks remaining) cc @dmoka`;

  broadcast(message);

  const alerts = getAlerts();
  await alerts.sendWebhook(message);
}
