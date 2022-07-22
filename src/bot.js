import {initApi, api} from './api.js';
import {Events} from "./events.js";
import xyk from "./handlers/xyk.js";
import {initDiscord} from "./discord.js";
import {rpc, sha, token, channel} from "./config.js";

async function main() {
  console.log('🐍⌚');
  console.log('snakewatch', sha);
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




