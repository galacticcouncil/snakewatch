import {broadcast} from "../discord.js";
import {formatAccount, formatAmount, formatAsset, loadCurrency} from "../currencies.js";
import {getAlerts} from "../utils/alerts.js";
import {metrics} from "../metrics.js";
import {toAccount} from "../utils/evm.js";
import {
  NTT_DEPLOYMENTS,
  currencySibling,
  formatNttRecipient,
  knownNttAsset,
  nttContractFromPayload,
  nttExecutionFailure,
  wormholeChain,
} from "../utils/ntt.js";
import nttManagerAbi from "../resources/ntt-manager.abi.js";
import nttTransceiverAbi from "../resources/ntt-transceiver.abi.js";

const managerControlEvents = [
  "Paused",
  "NotPaused",
  "OwnershipTransferred",
  "PauserTransferred",
  "Upgraded",
  "PeerUpdated",
  "ThresholdChanged",
  "TransceiverAdded",
  "TransceiverRemoved",
  "OutboundTransferLimitUpdated",
  "InboundTransferLimitUpdated",
];

const transceiverControlEvents = [
  "Paused",
  "NotPaused",
  "OwnershipTransferred",
  "PauserTransferred",
  "Upgraded",
  "SetWormholePeer",
];

const nttMetrics = metrics.register("ntt", {
  transfers_total: {
    type: "counter",
    help: "Number of observed NTT transfer lifecycle events",
    labels: ["asset", "direction", "peer", "status"],
  },
  control_changes_total: {
    type: "counter",
    help: "Number of observed NTT control-plane changes",
    labels: ["asset", "component", "event"],
  },
});

const atComponent = component => payload => nttContractFromPayload(payload)?.component === component;
const atManager = atComponent("manager");
const atTransceiver = atComponent("transceiver");

export default function nttHandler(events) {
  Promise.all(NTT_DEPLOYMENTS.map(({assetId}) => loadCurrency(assetId))).catch(() => {});

  events
    .onLog("TransferSent", nttManagerAbi, transferSent, payload =>
      atManager(payload) && payload.log.args.amount !== undefined)
    .onLog("TransferRedeemed", nttManagerAbi, transferRedeemed, atManager)
    .onLog("OutboundTransferRateLimited", nttManagerAbi, outboundRateLimited, atManager)
    .onLog("OutboundTransferCancelled", nttManagerAbi, outboundCancelled, atManager)
    .onLog("InboundTransferQueued", nttManagerAbi, inboundQueued, atManager)
    .onFilter("ethereum", "Executed", knownExecutionFailure, executionFailed)
    .onFilter("evmAccounts", "NttMinterSet", knownRuntimeAsset, nttMinterSet)
    .onFilter("evmAccounts", "NttMinterCleared", knownRuntimeAsset, nttMinterCleared);

  for (const eventName of managerControlEvents) {
    events.onLog(eventName, nttManagerAbi, controlChanged(eventName), atManager);
  }
  for (const eventName of transceiverControlEvents) {
    events.onLog(eventName, nttTransceiverAbi, controlChanged(eventName), atTransceiver);
  }
}

function knownExecutionFailure({event}) {
  return !!nttExecutionFailure(event);
}

async function executionFailed({event, blockNumber}) {
  const {deployment, code, description} = nttExecutionFailure(event);
  const direction = deployment.component === "transceiver" ? "inbound" : "outbound";
  const txHash = event.data.transactionHash?.toString();
  const recovery = code === "mint_limit_reached"
    ? "; origin funds remain locked and the VAA must be retried when mint headroom returns"
    : "; verify or restore the runtime NTT minter binding";
  const message = `${deployment.symbol} NTT ${direction} execution failed: ${description}${recovery}${txHash ? ` (tx \`${txHash}\`)` : ""}${blockNumber ? ` in block #${blockNumber}` : ""}`;

  broadcast(`🚨 ${message}`);
  await getAlerts().sendWebhooks(`🚨 **NTT DELIVERY FAILED** - ${message}`);
  countTransfer(deployment, direction, wormholeChain(deployment.peerChainId), code);
}

async function transferSent(payload) {
  const deployment = nttContractFromPayload(payload);
  const {recipient, amount, recipientChain, msgSequence} = payload.log.args;
  const sender = await outboundSender(payload.siblings, deployment.assetId);
  const account = sender ? `${formatAccount(sender)} ` : "";

  await loadCurrency(deployment.assetId);
  const asset = await formatAsset({currencyId: deployment.assetId, amount});
  const peer = wormholeChain(recipientChain);
  const destination = formatNttRecipient(recipient, recipientChain);

  broadcast(`${account}sent ${asset} from **Hydration** to **${peer}** via 🌀 NTT → \`${destination}\` (sequence ${msgSequence})`);
  countTransfer(deployment, "outbound", peer, "sent");
}

async function transferRedeemed(payload) {
  const deployment = nttContractFromPayload(payload);
  const deposit = currencySibling(payload.siblings, "Deposited", deployment.assetId);
  const peer = wormholeChain(deployment.peerChainId);

  if (!deposit) {
    await operationalAlert(
      deployment,
      "inbound",
      "redeemed_without_deposit",
      `${deployment.symbol} NTT emitted TransferRedeemed without a matching Hydration deposit (digest \`${payload.log.args.digest}\`)`,
    );
    return;
  }

  const {who, amount} = deposit.data;
  await loadCurrency(deployment.assetId);
  const asset = await formatAsset({currencyId: deployment.assetId, amount});

  broadcast(`${formatAccount(who)} received ${asset} from **${peer}** on **Hydration** via 🌀 NTT`);
  countTransfer(deployment, "inbound", peer, "redeemed");
}

async function outboundCancelled(payload) {
  const deployment = nttContractFromPayload(payload);
  const {recipient, amount, sequence} = payload.log.args;
  const account = await toAccount(recipient);

  await loadCurrency(deployment.assetId);
  const asset = await formatAsset({currencyId: deployment.assetId, amount});
  broadcast(`${formatAccount(account)} cancelled queued 🌀 NTT transfer #${sequence}; ${asset} returned on **Hydration**`);
  countTransfer(deployment, "outbound", wormholeChain(deployment.peerChainId), "cancelled");
}

async function outboundRateLimited(payload) {
  const deployment = nttContractFromPayload(payload);
  const {sender, sequence, amount, currentCapacity} = payload.log.args;
  const account = await toAccount(sender);
  await loadCurrency(deployment.assetId);

  await operationalAlert(
    deployment,
    "outbound",
    "queued",
    `${formatAccount(account)} had ${formatAmount({currencyId: deployment.assetId, amount})} queued by the Hydration NTT manager (sequence ${sequence}, capacity ${formatAmount({currencyId: deployment.assetId, amount: currentCapacity})})`,
  );
}

async function inboundQueued(payload) {
  const deployment = nttContractFromPayload(payload);
  await operationalAlert(
    deployment,
    "inbound",
    "queued",
    `${deployment.symbol} NTT inbound transfer queued on Hydration (digest \`${payload.log.args.digest}\`)`,
  );
}

async function operationalAlert(deployment, direction, status, message) {
  broadcast(`🚨 ${message}`);
  await getAlerts().sendWebhooks(`🚨 **NTT ALERT** - ${message}`);
  countTransfer(deployment, direction, wormholeChain(deployment.peerChainId), status);
}

function countTransfer(deployment, direction, peer, status) {
  nttMetrics.transfers_total.inc({asset: deployment.symbol, direction, peer, status});
}

function knownRuntimeAsset({event}) {
  return !!knownNttAsset(event.data.assetId);
}

async function nttMinterSet({event, blockNumber}) {
  const deployment = knownNttAsset(event.data.assetId);
  const minter = event.data.minter.toString();
  const mismatch = minter.toLowerCase() !== deployment.manager.toLowerCase();
  const detail = mismatch
    ? ` to unexpected manager \`${minter}\` (expected \`${deployment.manager}\`)`
    : ` to \`${minter}\``;
  await runtimeControlAlert(deployment, "NttMinterSet", `runtime minter set${detail}`, blockNumber);
}

async function nttMinterCleared({event, blockNumber}) {
  const deployment = knownNttAsset(event.data.assetId);
  await runtimeControlAlert(deployment, "NttMinterCleared", "runtime minter cleared (mint and burn disabled)", blockNumber);
}

async function runtimeControlAlert(deployment, eventName, description, blockNumber) {
  const message = `${deployment.symbol} NTT ${description}${blockNumber ? ` in block #${blockNumber}` : ""}`;
  broadcast(`⚙️ ${message}`);
  await getAlerts().sendWebhooks(`⚠️ **NTT CONTROL CHANGE** - ${message}`);
  nttMetrics.control_changes_total.inc({asset: deployment.symbol, component: "runtime", event: eventName});
}

function controlChanged(eventName) {
  return async payload => {
    const deployment = nttContractFromPayload(payload);
    await loadCurrency(deployment.assetId);
    const description = describeControlChange(eventName, payload.log.args, deployment);
    const message = `${deployment.symbol} NTT ${deployment.component} ${description}${payload.blockNumber ? ` in block #${payload.blockNumber}` : ""}`;

    broadcast(`⚙️ ${message}`);
    await getAlerts().sendWebhooks(`⚠️ **NTT CONTROL CHANGE** - ${message}`);
    nttMetrics.control_changes_total.inc({
      asset: deployment.symbol,
      component: deployment.component,
      event: eventName,
    });
  };
}

function describeControlChange(eventName, args, deployment) {
  switch (eventName) {
    case "Paused": return "paused";
    case "NotPaused": return "unpaused";
    case "OwnershipTransferred": return `owner changed from \`${args.previousOwner}\` to \`${args.newOwner}\``;
    case "PauserTransferred": return `pauser changed from \`${args.oldPauser}\` to \`${args.newPauser}\``;
    case "Upgraded": return `upgraded to implementation \`${args.implementation}\``;
    case "PeerUpdated":
      return `peer for ${wormholeChain(args.chainId_)} changed from \`${formatNttRecipient(args.oldPeerContract, args.chainId_)}\` to \`${formatNttRecipient(args.peerContract, args.chainId_)}\` (${args.oldPeerDecimals} → ${args.peerDecimals} decimals)`;
    case "SetWormholePeer":
      return `peer for ${wormholeChain(args.chainId)} set to \`${formatNttRecipient(args.peerContract, args.chainId)}\``;
    case "ThresholdChanged": return `threshold changed from ${args.oldThreshold} to ${args.threshold}`;
    case "TransceiverAdded": return `added transceiver \`${args.transceiver}\` (count ${args.transceiversNum}, threshold ${args.threshold})`;
    case "TransceiverRemoved": return `removed transceiver \`${args.transceiver}\` (threshold ${args.threshold})`;
    case "OutboundTransferLimitUpdated":
      return `outbound limit changed from ${formatAmount({currencyId: deployment.assetId, amount: args.oldLimit})} to ${formatAmount({currencyId: deployment.assetId, amount: args.newLimit})}`;
    case "InboundTransferLimitUpdated":
      return `inbound limit from ${wormholeChain(args.chainId)} changed from ${formatAmount({currencyId: deployment.assetId, amount: args.oldLimit})} to ${formatAmount({currencyId: deployment.assetId, amount: args.newLimit})}`;
    default: return eventName;
  }
}

async function outboundSender(siblings, assetId) {
  const transfer = currencySibling(siblings, "Transferred", assetId);
  if (transfer?.data?.from) return transfer.data.from;

  const executed = siblings.find(({section, method}) => section === "ethereum" && method === "Executed");
  return executed?.data?.from ? toAccount(executed.data.from) : null;
}
