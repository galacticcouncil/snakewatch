import { metrics } from '../metrics.js';
import { sdk } from '../api.js';
import PQueue from "p-queue";
import { endpoints } from "../endpoints.js";
import memoize from "memoizee";
import { broadcastOnce } from "../discord.js";
import {
  formatUsdNumber,
  loadCurrency,
  symbol
} from "../currencies.js";
import ethers from "ethers";
import Grafana from "./grafana.js";
import { grafanaUrl, grafanaDatasource } from "../config.js";
import {getAlerts} from "./alerts.js";

export default class OraclePrices {
  constructor(priceDivergenceThreshold) {
    this.prices = {};
    this.lastGlobalUpdate = -1;
    this.queue = new PQueue({concurrency: 20, timeout: 10000});
    this.priceDivergenceThreshold = priceDivergenceThreshold;

    this.metrics = metrics.register('oracleprices', {
      // Price metrics
      oracle_price: {
        type: 'gauge',
        help: 'Price from oracle',
        labels: ['asset_pair', 'key']
      },
      spot_price: {
        type: 'gauge',
        help: 'Price from spot trade router',
        labels: ['asset_pair']
      },
      price_divergence: {
        type: 'gauge',
        help: 'Percentage divergence between oracle and spot price',
        labels: ['asset_pair', 'key']
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
        help: 'Duration of price updates',
        buckets: [0.1, 0.5, 1, 2, 5, 10],
        labels: ['success']
      },
      update_errors_total: {
        type: 'counter',
        help: 'Number of failed updates',
        labels: ['key']
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
    '/by-divergence': {
      GET: (_, res) => res.json({
        lastGlobalUpdate: this.lastGlobalUpdate,
        lastUpdate: this.metrics.last_update_block.hashMap[''].value || -1,
        prices: this.byDivergence(),
      }),
    }, '/:key': {
      GET: ({params: {key}}, res) => res.json(this.byDivergence().filter(([pairKey]) => key === pairKey).map(([_, data]) => data)),
    }
  }

  // This method is no longer needed - we handle updates directly in the onLog handler
  handler(inner) {
    return async payload => {
      await inner(payload);
      const {log: {args: {key, value, timestamp}}, blockNumber} = payload;
      try {
        // Use 'oracle' as a generic contract identifier
        await this.update(key, value, timestamp);
        this.metrics.last_update_block.set(blockNumber);
      } catch (e) {
        console.error('failed to update oracle price', key, e);
      }
    }
  }

  byDivergence = memoize(() => Array.from(Object.entries(this.prices))
    .sort((a, b) => Math.abs(b[1].divergence) - Math.abs(a[1].divergence)));

  async init() {
    endpoints.registerEndpoint('oracleprices', this.api);

    this.assets = await sdk().getAllAssets();
    await Promise.all(this.assets.map(async ({id}) => await loadCurrency(id)));

    if (grafanaUrl) {
      console.log('loading oracle prices from grafana');
      const grafana = new Grafana(grafanaUrl, grafanaDatasource);

      const query = `SELECT 
        args->>'key' AS pair,
        (args->>'value')::numeric / 10^8 AS latest_value,
        to_timestamp((args->>'timestamp')::bigint) AS latest_timestamp,
        block_number AS latest_block_number
      FROM 
        logs AS l1
      WHERE 
        event_name = 'OracleUpdate'
        AND block_number = (
          SELECT MAX(block_number)
          FROM logs AS l2
          WHERE 
            l2.event_name = 'OracleUpdate'
            AND l2.args->>'key' = l1.args->>'key'
        )
      ORDER BY 
        pair`;

      const start = performance.now();
      try {
        const [pairs, values, timestamps, blockNumbers] = await grafana.query(query);
        const now = Date.now();

        // Get highest block number from the results
        const blockNumber = Math.max(...blockNumbers.map(num => parseInt(num)));

        // Process each oracle price
        for (let i = 0; i < pairs.length; i++) {
          const key = pairs[i];
          const value = parseFloat(values[i]);
          const timestamp = parseInt(timestamps[i]) / 1000; // Convert ms to seconds
          const itemBlockNumber = parseInt(blockNumbers[i]);

          // Store the oracle price first (without spot comparison initially)
          this.metrics.oracle_price.set({asset_pair: key, key}, value);
          this.prices[key] = {
            key,
            oraclePrice: value,
            timestamp: timestamp,
            updated: Date.now()
          };

          // Parse the key to identify the asset pair and try to get spot price
          if (key.includes('/')) {
            try {
              const [baseAsset, quoteAsset] = key.split('/');
              const baseAssetId = this.getAssetIdFromSymbol(baseAsset);
              const quoteAssetId = this.getAssetIdFromSymbol(quoteAsset);

              if (baseAssetId && quoteAssetId) {
                // Queue up the spot price check and comparison
                this.queue.add(async () => {
                  try {
                    const spotPrice = await this.getSpotPrice(baseAssetId, quoteAssetId);
                    if (spotPrice !== null) {
                      const divergence = this.calculateDivergence(value, spotPrice);

                      // Update metrics
                      this.metrics.spot_price.set({asset_pair: key}, spotPrice);
                      this.metrics.price_divergence.set({asset_pair: key, key}, divergence);

                      // Update stored data
                      this.prices[key] = {
                        ...this.prices[key],
                        spotPrice,
                        divergence,
                        baseAsset,
                        quoteAsset,
                        baseAssetId,
                        quoteAssetId
                      };

                      // Alert if divergence exceeds threshold
                      await this.checkAndAlertDivergence(baseAssetId, quoteAssetId, value, spotPrice, divergence);
                    }
                  } catch (e) {
                    console.error(`Failed to get spot price for ${key}:`, e);
                  }
                });
              }
            } catch (e) {
              console.error(`Failed to process price pair ${key}:`, e);
            }
          }
        }

        this.lastGlobalUpdate = blockNumber;
        this.metrics.last_global_update_block.set(blockNumber);
        this.metrics.last_update_block.set(blockNumber);

        console.log(`${pairs.length} oracle prices initialized from grafana in ${(performance.now() - start).toFixed(2)}ms`);
      } catch (e) {
        console.error('Failed to load oracle prices from grafana:', e);
      }
    }
  }

  getAssetIdFromSymbol(s) {
    if (s === "USD") return  this.getAssetIdFromSymbol("USDT");
    return this.assets.find(({symbol}) => symbol.toUpperCase() === s.toUpperCase())?.id;
  }

  async update(key, value, timestamp) {
    this.metrics.queue_length.set(this.queue.size);
    this.metrics.queue_pending.set(this.queue.pending);
    const timer = this.metrics.update_duration_seconds.startTimer();

    await this.queue.add(async () => {
      try {
        // Convert value to a proper number (value could be BigInt/ethers.BigNumber or already a number)
        let oraclePrice;
        if (typeof value === 'object' && value.toString && typeof value.toString === 'function') {
          // If it's an ethers BigNumber or similar object with toString method
          try {
            oraclePrice = Number(ethers.utils.formatUnits(value, 8));
          } catch (e) {
            // If formatUnits fails, try direct conversion
            oraclePrice = Number(value.toString()) / 10 ** 8;
          }
        } else if (typeof value === 'bigint') {
          // If it's a BigInt
          oraclePrice = Number(value) / 10 ** 8;
        } else {
          // If it's already a number or string representation
          oraclePrice = Number(value);
        }

        // Parse the key to identify the asset pair
        // Assuming key format like "BTC/USD"
        let assetPair = key;
        let baseAsset, quoteAsset;

        if (key.includes('/')) {
          [baseAsset, quoteAsset] = key.split('/');

          // Try to get spot price using the router
          try {
            // Convert symbol to asset IDs if needed
            const baseAssetId = this.getAssetIdFromSymbol(baseAsset);
            const quoteAssetId = this.getAssetIdFromSymbol(quoteAsset);

            if (baseAssetId && quoteAssetId) {
              // Get spot price from router using our helper
              const spotPrice = await this.getSpotPrice(baseAssetId, quoteAssetId);

              if (spotPrice !== null) {
                // Calculate divergence as percentage using our helper
                const divergence = this.calculateDivergence(oraclePrice, spotPrice);

                // Set metrics
                this.metrics.oracle_price.set({asset_pair: assetPair, key}, oraclePrice);
                this.metrics.spot_price.set({asset_pair: assetPair}, spotPrice);
                this.metrics.price_divergence.set({asset_pair: assetPair, key}, divergence);

                // Store price data
                this.prices[key] = {
                  key,
                  oraclePrice,
                  spotPrice,
                  divergence,
                  baseAsset,
                  quoteAsset,
                  baseAssetId,
                  quoteAssetId,
                  timestamp: Number(timestamp),
                  updated: Date.now()
                };

                // Alert if divergence exceeds threshold
                await this.checkAndAlertDivergence(baseAssetId, quoteAssetId, oraclePrice, spotPrice, divergence);
              }
            }
          } catch (e) {
            console.error(`Failed to get spot price for ${key}:`, e);
          }
        } else {
          // Store simple oracle price without pair comparison
          this.metrics.oracle_price.set({asset_pair: key, key}, oraclePrice);
          this.prices[key] = {
            key,
            oraclePrice,
            timestamp: Number(timestamp),
            updated: Date.now()
          };
        }

        this.byDivergence.clear();
        timer({success: 'true'});
      } catch (e) {
        timer({success: 'false'});
        this.metrics.update_errors_total.inc({key});
        console.error('failed to update price of', key, e);
      }
    });

    this.metrics.queue_length.set(this.queue.size);
    this.metrics.queue_pending.set(this.queue.pending);
  }

  // Helper to get spot price from router
  async getSpotPrice(baseAssetId, quoteAssetId) {
    try {
      const tradeInfo = await sdk().getBestSpotPrice(baseAssetId, quoteAssetId);

      if (!tradeInfo) {
        return null;
      }

      // Handle different formats that tradeInfo might return
      if (tradeInfo.amount !== undefined && tradeInfo.decimals !== undefined) {
        return Number(tradeInfo.amount) / (10 ** Number(tradeInfo.decimals));
      } else if (tradeInfo.spotPrice !== undefined) {
        return Number(tradeInfo.spotPrice) / (10 ** 12);
      } else {
        console.error(`Unexpected tradeInfo format for ${baseAssetId}/${quoteAssetId}:`, tradeInfo);
        return null;
      }
    } catch (e) {
      console.error(`Failed to get spot price for ${baseAssetId}/${quoteAssetId}:`, e);
      return null;
    }
  }

  // Helper to calculate price divergence
  calculateDivergence(oraclePrice, spotPrice) {
    return spotPrice > 0 ? (oraclePrice - spotPrice) / spotPrice : 0;
  }

  // Helper to check for significant divergence and broadcast alert if needed
  async checkAndAlertDivergence(baseAssetId, quoteAssetId, oraclePrice, spotPrice, divergence) {
    if (this.priceDivergenceThreshold && Math.abs(divergence) > this.priceDivergenceThreshold) {
      const divergencePercent = (divergence * 100).toFixed(2);
      const direction = divergence > 0 ? 'higher' : 'lower';
      broadcastOnce(`:warning: **${symbol(baseAssetId)}** borrowing oracle price **${formatUsdNumber(oraclePrice)}** is **${Math.abs(divergencePercent)}%** ${direction} than router spot price`);
      return true;
    }
    return false;
  }

  async updateAll(blockNumber) {
    if (blockNumber <= this.lastGlobalUpdate) {
      return;
    }

    const start = performance.now();
    const keys = Object.keys(this.prices);

    // Refresh all stored price pairs
    for (const key of keys) {
      try {
        const data = this.prices[key];
        if (data.baseAssetId && data.quoteAssetId) {
          const spotPrice = await this.getSpotPrice(data.baseAssetId, data.quoteAssetId);
          if (spotPrice !== null) {
            const divergence = this.calculateDivergence(data.oraclePrice, spotPrice);

            // Update metrics
            this.metrics.spot_price.set({asset_pair: key}, spotPrice);
            this.metrics.price_divergence.set({asset_pair: key, key}, divergence);

            const updated = Date.now();

            // Update stored data
            this.prices[key] = {
              ...data,
              spotPrice,
              divergence,
              updated,
            };

            try {
              // Check for price delta alerts
              const alerts = getAlerts();
              await alerts.checkPriceDelta(key, spotPrice, updated);
            } catch (e) {
              console.error(`Failed to check price delta for ${key}:`, e);
            }

            // Check if we need to alert on divergence
            await this.checkAndAlertDivergence(data.baseAssetId, data.quoteAssetId, data.oraclePrice, spotPrice, divergence);
          }
        }
      } catch (e) {
        console.error(`Failed to update spot price for ${key}:`, e);
      }
    }

    this.lastGlobalUpdate = blockNumber;
    this.metrics.last_global_update_block.set(blockNumber);
    this.metrics.last_update_block.set(blockNumber);
    this.byDivergence.clear();

    console.log(`updated prices of ${keys.length} pairs in ${(performance.now() - start).toFixed(2)}ms`);
  }
}
