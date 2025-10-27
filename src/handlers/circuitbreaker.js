import {broadcast} from "../discord.js";
import {formatAmount, loadCurrency, symbol} from "../currencies.js";
import {getAlerts} from "../utils/alerts.js";

export default function circuitBreakerHandler(events) {
  events.on('circuitBreaker', 'AssetLockdown', assetLockdownHandler);
}

async function assetLockdownHandler({event, blockNumber}) {
  const {assetId, until} = event.data;
  const blocksRemaining = until.toNumber() - blockNumber;

  await loadCurrency(assetId);
  const assetSymbol = symbol(assetId);

  const baseMessage = `🔒 **Circuit Breaker Triggered**: Asset **${assetSymbol}** (${assetId}) locked until block #${until} (~${blocksRemaining} blocks remaining)`;

  broadcast(baseMessage);

  const alerts = getAlerts();
  const webhookMessage = `${baseMessage} cc <@426092377288081410> <@&1001116487907545128>`;
  await alerts.sendWebhook(webhookMessage);
}
