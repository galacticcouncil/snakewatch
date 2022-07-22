import * as dotenv from 'dotenv';
dotenv.config();

export const rpc = process.env.RPC_URL || 'wss://localhost:9988';
export const token = process.env.DISCORD_TOKEN;
export const channel = process.env.DISCORD_CHANNEL;
export const sha = process.env.COMMIT_SHA || 'dev';
export const usdCurrencyId = process.env.USD_TOKEN || '4';
export const whaleAmount = (Number(process.env.WHALE_AMOUNT) || 10) * 10 ** 12;
