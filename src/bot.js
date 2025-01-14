import {initApi, api, sdk} from './api.js';
import {Events} from "./events.js";
import xyk from "./handlers/xyk.js";
import lbp from "./handlers/lbp.js";
import omnipool from "./handlers/omnipool.js";
import stableswap from "./handlers/stableswap.js";
import router from "./handlers/router.js";
import transfers from "./handlers/transfers.js";
import otc from "./handlers/otc.js";
import dca, {terminator} from "./handlers/dca.js";
import staking from "./handlers/staking.js";
import referrals from "./handlers/referrals.js";
import borrowing from "./handlers/borrowing.js";
import {initDiscord} from "./discord.js";
import {rpc, sha, token, channel} from "./config.js";
import {currenciesHandler} from "./currencies.js";
import {endpoints} from "./endpoints.js";
import process from "node:process";

async function main() {
  console.log('🐍⌚');
  console.log('snakewatch', sha);

  await initApi(rpc);

  if (!token || !channel) {
    console.log('missing discord token or channel');
    console.log('discord disabled');
  } else {
    await initDiscord(token, channel);
  }

  await endpoints.start();

  const events = new Events();

  console.log('watching for new blocks');
  events.startWatching();

  events.addHandler(currenciesHandler);
  events.addHandler(xyk);
  events.addHandler(lbp);
  events.addHandler(omnipool);
  events.addHandler(stableswap);
  events.addHandler(router);
  events.addHandler(otc);
  events.addHandler(dca)
  events.addHandler(transfers);
  events.addHandler(staking);
  events.addHandler(referrals);
  events.addHandler(borrowing);

  if (process.env.NODE_ENV === 'test') {
    console.log('testing mode: pushing testing blocks');
    const blockNumbers = new Set([]);
    blockNumbers.add(4776718);
    blockNumbers.add(4012925);
    blockNumbers.add(3640483);
    blockNumbers.add(3640479);
    blockNumbers.add(3640440);
    blockNumbers.add(3640419);
    blockNumbers.add(3640110);

    for (const height of [...blockNumbers].sort()) {
      await events.emitFromBlock(height);
    }
    const lookBack = process.env.LOOK_BACK || 10;
    console.log(`testing mode: pushing last ${lookBack} blocks`);
    const lastBlock = await api().query.system.number();
    for (let i = lastBlock - lookBack; i <= lastBlock; i++) {
      await events.emitFromBlock(i);
    }
  }
}

main().catch(err => {
  console.error(err);
  exit(1);
});

[
  'SIGHUP', 'SIGINT', 'SIGQUIT', 'SIGILL', 'SIGTRAP', 'SIGABRT',
  'SIGBUS', 'SIGFPE', 'SIGUSR1', 'SIGSEGV', 'SIGUSR2', 'SIGTERM'
].forEach((signal, index) => process.on(signal, () => exit(128 + index + 1)));

function exit(code = 0) {
  terminator();
  setTimeout(() => process.exit(code), 500);
}


