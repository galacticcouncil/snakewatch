import {grafanaDatasource, grafanaUrl, liquidationAlert} from "../config.js";
import Grafana from "./grafana.js";
import {normalizeAddress, provider, toAccount} from "./evm.js";
import poolAbi from "../resources/aave-pool.abi.js";
import ethers from "ethers";
import PQueue from "p-queue";
import {endpoints} from "../endpoints.js";
import memoize from "memoizee";
import {broadcastOnce} from "../discord.js";
import {formatAccount, formatUsdNumber, loadCurrency} from "../currencies.js";

export default class Borrowers {
  constructor() {
    this.health = {};
    this.lastGlobalUpdate = -1;
    this.lastUpdate = -1;
    this.queue = new PQueue({concurrency: 20, timeout: 10000});
  }

  api = {
    '/by-health': {
      GET: (_, res) => res.json({
        lastGlobalUpdate: this.lastGlobalUpdate,
        lastUpdate: this.lastUpdate,
        borrowers: this.byHealth().filter(([, data]) => data.healthFactor < 2)
      }),
    }, '/:address': {
      GET: ({params: {address}}, res) => res.json(this.byHealth().filter(([user]) => address === user).map(([_, data]) => data)),
    }
  }

  handler(inner) {
    return async payload => {
      await inner(payload);
      try {
        const {log: {args: {user}}, event: {data: {log: {address}}}, blockNumber} = payload;
        await this.update(address.toHex(), user);
        this.lastUpdate = blockNumber;
      } catch (e) {
        console.error('failed to update borrower health', payload, e);
      }
    }
  }

  byHealth = memoize(() => Array.from(Object.values(this.health))
    .flatMap(m => Array.from(m.entries()))
    .sort((a, b) => a[1].healthFactor - b[1].healthFactor));

  async init() {
    await loadCurrency(0);
    endpoints.registerEndpoint('borrowers', this.api);
    if (grafanaUrl) {
      console.log('loading borrowers from grafana');
      const grafana = new Grafana(grafanaUrl, grafanaDatasource);
      const [contracts, addresses] = await grafana.query("select distinct contract, topic2 from frontier_evm_log where topic0 = '0xb3d084820fb1a9decffb176436bd02558d15fac9b0ddfed8c465bc7359d7dce0'");
      const start = performance.now();
      await Promise.all(addresses.map((address, i) => this.update(contracts[i], normalizeAddress(address))));
      console.log(addresses.length + ' borrowers initialized from grafana in ' + (performance.now() - start).toFixed(2) + 'ms');
      console.log(Object.keys(this.health))
    }
  }

  async update(contract, address) {
    if (!this.health[contract]) {
      this.health[contract] = new Map();
    }
    const healthFactor = this.health[contract].get(address)?.healthFactor;
    const priority = healthFactor ? 1 / healthFactor : 0;
    return this.queue.add(async () => {
      try {
        const data = await getUserAccountData(contract, address);
        if (data.healthFactor < liquidationAlert) {
          const health = `:${data.healthFactor < 1 ? 'broken_heart' : 'heart'}:**${(Math.floor(data.healthFactor * 100) / 100).toFixed(2)}**`;
          broadcastOnce(`:rotating_light: liquidation imminent for ${formatAccount(data.account)} position ${health} with **${formatUsdNumber(data.totalCollateralBase)}** collateral at risk `);
        }
        this.health[contract].set(address, data);
        this.byHealth.clear();
      } catch (e) {
        console.error('failed to update health of', address, 'in', contract, e);
      }
    }, {priority});
  }

  async updateAll(blockNumber) {
    if (blockNumber <= this.lastGlobalUpdate) {
      return;
    }
    for (const [contract, addresses] of Object.entries(this.health)) {
      const start = performance.now();
      await Promise.all([...addresses.keys()].map(address => this.update(contract, address)));
      this.lastGlobalUpdate = blockNumber;
      this.lastUpdate = blockNumber;
      console.log(`updated health of ${addresses.size} borrowers in ${(performance.now() - start).toFixed(2)}ms`);
    }
  }
}

async function getUserAccountData(pool, address) {
  if (!ethers.utils.isAddress(address)) {
    throw new Error('Invalid user address: ' + address);
  }

  const poolContract = new ethers.Contract(pool, poolAbi, provider);
  const [data, account] = await Promise.all([poolContract.getUserAccountData(address), toAccount(address)]);

  return {
    totalCollateralBase: Number(ethers.utils.formatUnits(data.totalCollateralBase, 8)),
    totalDebtBase: Number(ethers.utils.formatUnits(data.totalDebtBase, 8)),
    availableBorrowsBase: Number(ethers.utils.formatUnits(data.availableBorrowsBase, 8)),
    currentLiquidationThreshold: data.currentLiquidationThreshold.toString() / 100, // Convert to percentage
    ltv: data.ltv.toString() / 100, // Convert to percentage
    healthFactor: Number(ethers.utils.formatUnits(data.healthFactor, 18)),
    updated: Date.now(),
    account,
    pool,
  };
}
