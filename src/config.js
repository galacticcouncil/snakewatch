import * as dotenv from 'dotenv';
dotenv.config();

export const rpc = process.env.RPC_URL || 'wss://localhost:9988';
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
export const mute = process.env.MUTE?.split(",") || ['BLAST'];

export const slackAlertWebhook = process.env.SLACK_ALERT_WEBHOOK;
export const slackAlertHF = process.env.ALERT_HF;
export const slackAlertRate = process.env.ALERT_RATE;
export const slackAlertPriceDelta = process.env.ALERT_PRICE_DELTA;
