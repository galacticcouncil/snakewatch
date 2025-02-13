import client from 'prom-client';
import { endpoints } from './endpoints.js';

class MetricsRegistry {
  constructor() {
    // Clear default metrics and initialize custom registry
    client.register.clear();
    this.registry = new client.Registry();
    this.registeredMetrics = new Map();

    // Enable collection of default metrics
    this.collectDefaultMetrics();

    // Register metrics endpoint
    this.registerMetricsEndpoint();
  }

  collectDefaultMetrics() {
    client.collectDefaultMetrics({
      register: this.registry,
      prefix: 'snakewatch_'
    });
  }

  register(namespace, metrics) {
    if (this.registeredMetrics.has(namespace)) {
      throw new Error(`Metrics for namespace '${namespace}' are already registered`);
    }

    const initializedMetrics = {};

    Object.entries(metrics).forEach(([name, config]) => {
      const metricName = `${namespace}_${name}`;

      let metric;
      switch (config.type) {
        case 'counter':
          metric = new client.Counter({
            name: metricName,
            help: config.help,
            labelNames: config.labels || [],
            registers: [this.registry]
          });
          break;

        case 'gauge':
          metric = new client.Gauge({
            name: metricName,
            help: config.help,
            labelNames: config.labels || [],
            registers: [this.registry]
          });
          break;

        case 'histogram':
          metric = new client.Histogram({
            name: metricName,
            help: config.help,
            labelNames: config.labels || [],
            buckets: config.buckets || [0.1, 0.5, 1, 2, 5],
            registers: [this.registry]
          });
          break;

        case 'summary':
          metric = new client.Summary({
            name: metricName,
            help: config.help,
            labelNames: config.labels || [],
            percentiles: config.percentiles || [0.01, 0.05, 0.5, 0.9, 0.95, 0.99],
            registers: [this.registry]
          });
          break;

        default:
          throw new Error(`Unknown metric type: ${config.type}`);
      }

      initializedMetrics[name] = metric;
    });

    this.registeredMetrics.set(namespace, initializedMetrics);
    return initializedMetrics;
  }

  getMetrics(namespace) {
    return this.registeredMetrics.get(namespace);
  }

  getRegisteredMetrics() {
    return Array.from(this.registeredMetrics.keys());
  }

  async getPrometheusMetrics() {
    return this.registry.metrics();
  }

  getContentType() {
    return this.registry.contentType;
  }

  registerMetricsEndpoint() {
    endpoints.registerEndpoint('metrics', {
      '/': {
        GET: async (req, res) => {
          const metrics = await this.getPrometheusMetrics();
          res.set('Content-Type', this.getContentType());
          res.end(metrics);
        }
      }
    }, { prefix: false });
  }
}

export const metrics = new MetricsRegistry();
