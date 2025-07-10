import { metrics } from '../metrics.js';
import { endpoints } from "../endpoints.js";
import memoize from "memoizee";

class Alerts {
  constructor() {
    this.activeAlerts = new Map();
    this.alertHistory = [];
    this.alertConfigs = {
      hf: [],
      rate: [],
      priceDeltas: []
    };
    this.priceWindows = new Map();
    this.webhookUrl = null;
    
    this.metrics = metrics.register('alerts', {
      active_alerts: {
        type: 'gauge',
        help: 'Number of currently active alerts',
        labels: ['type']
      },
      alert_triggers_total: {
        type: 'counter',
        help: 'Total number of alert triggers',
        labels: ['type', 'state']
      },
      webhook_notifications_total: {
        type: 'counter',
        help: 'Total webhook notifications sent',
        labels: ['success']
      },
      alert_history_size: {
        type: 'gauge',
        help: 'Size of alert history'
      }
    });
  }

  api = {
    '/active': {
      GET: (_, res) => res.json({
        activeAlerts: Object.fromEntries(this.activeAlerts),
        configs: this.alertConfigs
      })
    },
    '/history': {
      GET: (_, res) => res.json({
        history: this.alertHistory.slice(-100)
      })
    },
    '/config': {
      GET: (_, res) => res.json(this.alertConfigs)
    }
  }

  async init() {
    endpoints.registerEndpoint('alerts', this.api);
    await this.loadConfiguration();
    console.log('Alerts system initialized');
  }

  async loadConfiguration() {
    try {
      this.webhookUrl = process.env.ALERT_WEBHOOK_SLACK || null;
      
      if (process.env.ALERT_HF) {
        this.alertConfigs.hf = JSON.parse(process.env.ALERT_HF);
      }
      
      if (process.env.ALERT_RATE) {
        this.alertConfigs.rate = JSON.parse(process.env.ALERT_RATE);
      }
      
      if (process.env.ALERT_PRICE_DELTA) {
        this.alertConfigs.priceDeltas = JSON.parse(process.env.ALERT_PRICE_DELTA);
        this.initializePriceWindows();
      }
      
      console.log('Alert configuration loaded:', {
        webhook: !!this.webhookUrl,
        hf: this.alertConfigs.hf.length,
        rate: this.alertConfigs.rate.length,
        priceDeltas: this.alertConfigs.priceDeltas.length
      });
    } catch (error) {
      console.error('Failed to load alert configuration:', error);
    }
  }

  initializePriceWindows() {
    for (const [pair, percentage, window] of this.alertConfigs.priceDeltas) {
      this.priceWindows.set(pair, {
        windowMs: this.parseTimeWindow(window),
        prices: [],
        lastAlert: 0
      });
    }
  }

  parseTimeWindow(window) {
    const match = window.match(/^(\d+)([smhd])$/);
    if (!match) return 600000; // Default 10 minutes
    
    const [, value, unit] = match;
    const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
    return parseInt(value) * multipliers[unit];
  }

  async sendWebhook(message) {
    if (!this.webhookUrl) return false;
    
    try {
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: message })
      });
      
      const success = response.ok;
      this.metrics.webhook_notifications_total.inc({ success: success.toString() });
      
      if (!success) {
        console.error('Webhook notification failed:', response.status, response.statusText);
      }
      
      return success;
    } catch (error) {
      console.error('Failed to send webhook notification:', error);
      this.metrics.webhook_notifications_total.inc({ success: 'false' });
      return false;
    }
  }

  async triggerAlert(type, key, state, message) {
    const alertKey = `${type}:${key}`;
    const isActive = this.activeAlerts.has(alertKey);
    
    if (state === 'BAD' && !isActive) {
      this.activeAlerts.set(alertKey, {
        type,
        key,
        state,
        message,
        triggeredAt: Date.now()
      });
      
      this.metrics.active_alerts.set({ type }, this.getActiveAlertsCount(type));
      this.metrics.alert_triggers_total.inc({ type, state });
      
      await this.sendWebhook(`🚨 **ALERT TRIGGERED** - ${message}`);
      
      this.addToHistory(type, key, state, message);
      
    } else if (state === 'GOOD' && isActive) {
      this.activeAlerts.delete(alertKey);
      
      this.metrics.active_alerts.set({ type }, this.getActiveAlertsCount(type));
      this.metrics.alert_triggers_total.inc({ type, state });
      
      await this.sendWebhook(`✅ **ALERT RESOLVED** - ${message}`);
      
      this.addToHistory(type, key, state, message);
    }
  }

  addToHistory(type, key, state, message) {
    this.alertHistory.push({
      type,
      key,
      state,
      message,
      timestamp: Date.now()
    });
    
    if (this.alertHistory.length > 1000) {
      this.alertHistory = this.alertHistory.slice(-500);
    }
    
    this.metrics.alert_history_size.set(this.alertHistory.length);
  }

  getActiveAlertsCount(type) {
    return Array.from(this.activeAlerts.values())
      .filter(alert => alert.type === type).length;
  }

  async checkHealthFactor(account, healthFactor) {
    for (const [configAccount, threshold] of this.alertConfigs.hf) {
      if (account === configAccount) {
        const state = healthFactor < threshold ? 'BAD' : 'GOOD';
        const message = `Account ${account} health factor ${healthFactor.toFixed(3)} ${state === 'BAD' ? '<' : '>='} ${threshold}`;
        
        await this.triggerAlert('hf', account, state, message);
        break;
      }
    }
  }

  async checkInterestRate(reserve, type, rate) {
    for (const [configReserve, configType, configRate] of this.alertConfigs.rate) {
      if (reserve === configReserve && type === configType) {
        const threshold = parseFloat(configRate.replace('%', '')) / 100;
        let state;
        
        if (configType === 'borrow') {
          state = rate > threshold ? 'BAD' : 'GOOD';
        } else {
          state = rate < threshold ? 'BAD' : 'GOOD';
        }
        
        const message = `${reserve} ${type} rate ${(rate * 100).toFixed(2)}% APY ${state === 'BAD' ? 'exceeds' : 'within'} threshold ${configRate}`;
        
        await this.triggerAlert('rate', `${reserve}:${type}`, state, message);
        break;
      }
    }
  }

  async checkPriceDelta(pair, currentPrice) {
    const windowData = this.priceWindows.get(pair);
    if (!windowData) return;
    
    const now = Date.now();
    const { windowMs, prices } = windowData;
    
    prices.push({ price: currentPrice, timestamp: now });
    
    const cutoff = now - windowMs;
    windowData.prices = prices.filter(p => p.timestamp >= cutoff);
    
    if (windowData.prices.length < 2) return;
    
    const oldestPrice = windowData.prices[0].price;
    const priceChange = Math.abs((currentPrice - oldestPrice) / oldestPrice);
    
    const [, configPercentage] = this.alertConfigs.priceDeltas.find(([p]) => p === pair) || [];
    if (!configPercentage) return;
    
    const threshold = parseFloat(configPercentage.replace('%', '')) / 100;
    
    if (priceChange > threshold && now - windowData.lastAlert > windowMs) {
      const message = `${pair} price changed ${(priceChange * 100).toFixed(2)}% (${oldestPrice.toFixed(6)} → ${currentPrice.toFixed(6)}) in ${this.formatDuration(windowMs)}`;
      
      await this.triggerAlert('price_delta', pair, 'BAD', message);
      
      windowData.lastAlert = now;
      windowData.prices = [{ price: currentPrice, timestamp: now }];
    }
  }

  formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d`;
    if (hours > 0) return `${hours}h`;
    if (minutes > 0) return `${minutes}m`;
    return `${seconds}s`;
  }
}

// Singleton instance
let alertsInstance = null;

export function getAlerts() {
  if (!alertsInstance) {
    alertsInstance = new Alerts();
  }
  return alertsInstance;
}

export async function initAlerts() {
  const alerts = getAlerts();
  await alerts.init();
  return alerts;
}

export default getAlerts;