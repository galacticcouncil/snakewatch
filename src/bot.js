import * as dotenv from 'dotenv';
import {initApi, api} from './api.js';
import {Events} from "./events.js";
import xyk from "./handlers/xyk.js";
import {initDiscord} from "./discord.js";

dotenv.config();

const rpc = process.env.RPC_URL || 'wss://localhost:9988';
const token = process.env.DISCORD_TOKEN;
const channel = process.env.DISCORD_CHANNEL;

async function main() {
  console.log('🐍⌚');
  console.log('snakewatch', process.env.COMMIT_SHA || 'dev');
  await initApi(rpc);
  const {rpc: {system}} = api();
  const [chain, version] = await Promise.all([system.chain(), system.version()]);
  console.log(`connected to ${rpc} (${chain} ${version})`);
  await initDiscord(token, channel);

  const events = new Events();
  events.addHandler(xyk);

  events.emitFromBlock(454640);

  events.startWatching();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});




