import OraclePrices from "../utils/oracleprices.js";
import oracleAbi from "../resources/dia-oracle.abi.js";
import {priceDivergenceThreshold} from "../config.js";

const oraclePrices = new OraclePrices(priceDivergenceThreshold);

export default function oracleHandler(events) {
  events.onSection('broadcast', async ({blockNumber}) => await oraclePrices.updateAll(blockNumber))
  events
    .onLog('OracleUpdate', oracleAbi, payload => {
      const {key, value, timestamp} = payload.log.args;
      console.log(`oracle update: ${key} = ${value}`);

      // Process oracle update
      oraclePrices.update(key, value, timestamp)
        .catch(err => console.error(`Failed to process oracle update for ${key}:`, err));
    });

  // Initialize oracle prices
  oraclePrices.init().catch(err => {
    console.error('Failed to initialize oracle prices:', err);
  });

  return oraclePrices;
}
