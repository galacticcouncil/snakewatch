import * as dotenv from 'dotenv';
dotenv.config();

const rpcUrls = (process.env.RPC_URL || 'wss://localhost:9988')
  .split(',').map(s => s.trim()).filter(Boolean);
export const rpc = rpcUrls[Math.floor(Math.random() * rpcUrls.length)];
export const ahRpc = process.env.AH_RPC_URL || 'wss://polkadot-asset-hub-rpc.polkadot.io';
export const delay = Number(process.env.DELAY || 4);
export const token = process.env.DISCORD_TOKEN;
export const channel = process.env.DISCORD_CHANNEL;
export const sha = process.env.COMMIT_SHA || 'dev';
export const usdCurrencyId = process.env.USD_TOKEN || '10';
export const whaleAmount = (Number(process.env.WHALE_AMOUNT) || 10) * 10 ** 12;
export const grafanaUrl = process.env.GRAFANA || 'https://grafana.hydradx.cloud/api/ds/query';
export const grafanaDatasource = process.env.GRAFANA_DATASOURCE || 10;
export const port = process.env.PORT || 3000;
export const liquidationAlert = Number(process.env.LIQ_ALERT);
export const priceDivergenceThreshold = Number(process.env.PRICE_DIVERGENCE); // e.g 0.03 = 3%
export const timeout = Number(process.env.TIMEOUT) || 120;
export const mute = process.env.MUTE?.split(",") || ['BLAST', 'stHDX'];

export const slackAlertWebhook = process.env.SLACK_ALERT_WEBHOOK;
// JSON array of webhook URLs; falls back to wrapping the legacy single webhook
export const slackAlertWebhooks = process.env.SLACK_ALERT_WEBHOOKS
  || (slackAlertWebhook ? JSON.stringify([slackAlertWebhook]) : undefined);
export const discordWebhook = process.env.DISCORD_WEBHOOK;
export const slackAlertHF = process.env.ALERT_HF;
export const slackAlertRate = process.env.ALERT_RATE;
export const slackAlertPriceDelta = process.env.ALERT_PRICE_DELTA;
export const alertDeployment = process.env.ALERT_DEPLOYMENT; // truthy ("1"/"true"/"yes"/"on") to notify on every contract deployment

// ── NTT backing monitor ── origin-chain RPCs for reading hub custody balances
export const ethRpc = process.env.ETH_RPC || 'https://ethereum-rpc.publicnode.com';
export const baseRpc = process.env.BASE_RPC || 'https://base-rpc.publicnode.com';
export const solanaRpc = process.env.SOLANA_RPC || 'https://api.mainnet-beta.solana.com';
export const suiRpc = process.env.SUI_RPC || 'https://sui-rpc.publicnode.com';
export const backingIntervalSeconds = Number(process.env.BACKING_INTERVAL || 300); // poll cadence
export const backingThreshold = Number(process.env.BACKING_THRESHOLD || 1); // custody/supply below this ⇒ under-backed
export const backingReAlertHours = Number(process.env.BACKING_REALERT_HOURS || 6); // re-alert cadence while under-backed
export const backingDisabled = /^(1|true|yes|on)$/i.test(process.env.BACKING_DISABLED || ''); // set to skip the monitor
