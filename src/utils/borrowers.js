import { metrics } from '../metrics.js';
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
    this.queue = new PQueue({concurrency: 20, timeout: 10000});

    this.metrics = metrics.register('borrowers', {
      // Health metrics
      health_factor: {
        type: 'gauge',
        help: 'Borrower health factor',
        labels: ['contract', 'address', 'account']
      },
      total_collateral_base: {
        type: 'gauge',
        help: 'Total collateral in base currency',
        labels: ['contract', 'address', 'account']
      },
      total_debt_base: {
        type: 'gauge',
        help: 'Total debt in base currency',
        labels: ['contract', 'address', 'account']
      },
      available_borrows_base: {
        type: 'gauge',
        help: 'Available borrows in base currency',
        labels: ['contract', 'address', 'account']
      },

      // Queue metrics
      queue_length: {
        type: 'gauge',
        help: 'Current length of the update queue'
      },
      queue_pending: {
        type: 'gauge',
        help: 'Number of pending tasks in queue'
      },

      // Update metrics
      update_duration_seconds: {
        type: 'histogram',
        help: 'Duration of borrower updates',
        buckets: [0.1, 0.5, 1, 2, 5, 10],
        labels: ['success']
      },
      update_errors_total: {
        type: 'counter',
        help: 'Number of failed updates',
        labels: ['contract']
      },
      last_update_block: {
        type: 'gauge',
        help: 'Block of last update'
      },
      last_global_update_block: {
        type: 'gauge',
        help: 'Block of last global update'
      }
    });
  }

  api = {
    '/by-health': {
      GET: (_, res) => res.json({
        lastGlobalUpdate: this.lastGlobalUpdate,
        lastUpdate: this.metrics.last_update_block.hashMap[''].value || -1,
        borrowers: this.byHealth().filter(([, data]) => data.healthFactor < 2)
      }),
    }, '/:address': {
      GET: ({params: {address}}, res) => res.json(this.byHealth().filter(([user]) => address === user).map(([_, data]) => data)),
    }
  }

  handler(inner) {
    return async payload => {
      await inner(payload);
      const {log: {args: {user}}, event: {data: {log: {address}}}, blockNumber} = payload;
      try {
        await this.update(address.toHex(), user?.toLowerCase());
        this.metrics.last_update_block.set(blockNumber);
      } catch (e) {
        console.error('failed to update borrower health', address, e);
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
      const blockNumber = await provider.getBlockNumber();
      await Promise.all(addresses.map((address, i) => this.update(contracts[i], normalizeAddress(address))));
      this.lastGlobalUpdate = blockNumber;
      this.metrics.last_global_update_block.set(blockNumber);
      this.metrics.last_update_block.set(blockNumber);
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

    this.metrics.queue_length.set(this.queue.size);
    this.metrics.queue_pending.set(this.queue.pending);
    const timer = this.metrics.update_duration_seconds.startTimer();

    await this.queue.add(async () => {
      try {
        const data = await getUserAccountData(contract, address);

        const labels = { contract, address, account: data.account.toString() };
        this.metrics.health_factor.set(labels, data.healthFactor);
        this.metrics.total_collateral_base.set(labels, data.totalCollateralBase);
        this.metrics.total_debt_base.set(labels, data.totalDebtBase);
        this.metrics.available_borrows_base.set(labels, data.availableBorrowsBase);

        if (data.healthFactor < liquidationAlert) {
          const health = `:${data.healthFactor < 1 ? 'broken_heart' : 'heart'}:**${(Math.floor(data.healthFactor * 100) / 100).toFixed(2)}**`;
          broadcastOnce(`:rotating_light: liquidation imminent for ${formatAccount(data.account)} position ${health} with **${formatUsdNumber(data.totalCollateralBase)}** collateral at risk `);
        }

        this.health[contract].set(address, data);
        this.byHealth.clear();
        timer({success: 'true'});
      } catch (e) {
        timer({success: 'false'});
        this.metrics.update_errors_total.inc({contract});
        console.error('failed to update health of', address, 'in', contract, e);
      }
    }, {priority});

    this.metrics.queue_length.set(this.queue.size);
    this.metrics.queue_pending.set(this.queue.pending);
  }

  async updateAll(blockNumber) {
    if (blockNumber <= this.lastGlobalUpdate) {
      return;
    }
    for (const [contract, addresses] of Object.entries(this.health)) {
      const start = performance.now();
      await Promise.all([...addresses.keys()].map(address => this.update(contract, address)));
      this.lastGlobalUpdate = blockNumber;
      this.metrics.last_global_update_block.set(blockNumber);
      this.metrics.last_update_block.set(blockNumber);
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
