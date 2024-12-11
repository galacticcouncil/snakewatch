import * as dotenv from 'dotenv';
dotenv.config();

export const rpc = process.env.RPC_URL || 'wss://localhost:9988';
export const ahRpc = process.env.AH_RPC_URL || 'wss://polkadot-asset-hub-rpc.polkadot.io';
export const token = process.env.DISCORD_TOKEN;
export const channel = process.env.DISCORD_CHANNEL;
export const sha = process.env.COMMIT_SHA || 'dev';
export const usdCurrencyId = process.env.USD_TOKEN || '4';
export const whaleAmount = (Number(process.env.WHALE_AMOUNT) || 10) * 10 ** 12;
export const grafanaUrl = process.env.GRAFANA;
export const grafanaDatasource = process.env.GRAFANA_DATASOURCE || 10;
export const port = process.env.PORT || 3000;
export const liquidationAlert = Number(process.env.LIQ_ALERT);
