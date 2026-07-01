import {endpoints} from './endpoints.js';
import {timeout} from './config.js';

let lastBlockNumber = null;
let lastBlockAt = null;

export function recordBlock(number) {
  lastBlockNumber = number;
  lastBlockAt = Date.now();
}

export function health() {
  const ageMs = lastBlockAt === null ? null : Date.now() - lastBlockAt;
  const healthy = ageMs !== null && ageMs < timeout * 1000;
  return {
    healthy,
    lastBlock: lastBlockNumber,
    lastBlockAgeSeconds: ageMs === null ? null : Math.round(ageMs / 1000),
    timeoutSeconds: timeout,
  };
}

endpoints.registerEndpoint('health', {
  '/': {
    GET: async (req, res) => {
      const h = health();
      res.status(h.healthy ? 200 : 503).json({status: h.healthy ? 'ok' : 'stalled', ...h});
    },
  },
}, {prefix: false});
