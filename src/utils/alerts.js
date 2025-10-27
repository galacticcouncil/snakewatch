import { metrics } from '../metrics.js';
import { endpoints } from "../endpoints.js";
import { slackAlertWebhook, discordWebhook, slackAlertHF, slackAlertRate, slackAlertPriceDelta } from '../config.js';

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
      if (slackAlertHF) {
        this.alertConfigs.hf = JSON.parse(slackAlertHF);
      }
      
      if (slackAlertRate) {
        this.alertConfigs.rate = JSON.parse(slackAlertRate);
      }
      
      if (slackAlertPriceDelta) {
        this.alertConfigs.priceDeltas = JSON.parse(slackAlertPriceDelta);
        this.initializePriceWindows();
      }
      
      console.log('Alert configuration loaded:', {
        slackWebhook: !!slackAlertWebhook,
        discordWebhook: !!discordWebhook,
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
    if (!slackAlertWebhook && !discordWebhook) return false;

    const results = [];

    // Send to Slack
    if (slackAlertWebhook) {
      try {
        const response = await fetch(slackAlertWebhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: message })
        });

        const success = response.ok;
        this.metrics.webhook_notifications_total.inc({ success: success.toString() });

        if (!success) {
          console.error('Slack webhook notification failed:', response.status, response.statusText);
        }

        results.push(success);
      } catch (error) {
        console.error('Failed to send Slack webhook notification:', error);
        this.metrics.webhook_notifications_total.inc({ success: 'false' });
        results.push(false);
      }
    }

    // Send to Discord
    if (discordWebhook) {
      try {
        const response = await fetch(discordWebhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: message })
        });

        const success = response.ok;
        this.metrics.webhook_notifications_total.inc({ success: success.toString() });

        if (!success) {
          console.error('Discord webhook notification failed:', response.status, response.statusText);
        }

        results.push(success);
      } catch (error) {
        console.error('Failed to send Discord webhook notification:', error);
        this.metrics.webhook_notifications_total.inc({ success: 'false' });
        results.push(false);
      }
    }

    return results.some(r => r);
  }

  async triggerAlert(type, key, state, message, canBeActive = true) {
    const alertKey = `${type}:${key}`;
    const isActive = this.activeAlerts.has(alertKey);
    
    if (state === 'BAD' && (!canBeActive || !isActive)) {
      if (canBeActive) {
        this.activeAlerts.set(alertKey, {
          type,
          key,
          state,
          message,
          triggeredAt: Date.now()
        });

        this.metrics.active_alerts.set({ type }, this.getActiveAlertsCount(type));
      }
      
      this.metrics.alert_triggers_total.inc({ type, state });
      
      await this.sendWebhook(`🚨 **ALERT TRIGGERED** - ${message}`);
      
      this.addToHistory(type, key, state, message);
      
    } else if (state === 'GOOD' && (!canBeActive || isActive)) {
      if (canBeActive) {
        this.activeAlerts.delete(alertKey);
        this.metrics.active_alerts.set({ type }, this.getActiveAlertsCount(type));
      }
      
      
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
        const message = state === 'BAD'
          ? `Your Health Factor of Your Supply&Borrow position on Hydration is below ${threshold} (currently ${healthFactor.toFixed(2)})`
          : 'Your Healfh Factor of Your Supply&Borrow position on Hydration is SAFU'
        
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
        
        const message = `Interest rate for ${type}ing ${reserve} is now ${(rate * 100).toFixed(2)} %`
        
        await this.triggerAlert('rate', `${reserve}:${type}`, state, message);
        break;
      }
    }
  }

  async checkPriceDelta(pair, currentPrice, timestamp) {
    if (!currentPrice) {
      return;
    }

    const windowData = this.priceWindows.get(pair);
    if (!windowData) return;
    
    const { windowMs, prices } = windowData;
    
    prices.push({ price: currentPrice, timestamp });
    
    const cutoff = timestamp - windowMs;
    windowData.prices = prices.filter(p => p.timestamp >= cutoff);
    
    if (windowData.prices.length < 2) return;
    
    const oldestPrice = windowData.prices[0].price;
    const priceChange = Math.abs((currentPrice - oldestPrice) / oldestPrice);
    
    const [, configPercentage] = this.alertConfigs.priceDeltas.find(([p]) => p === pair) || [];
    if (!configPercentage) return;
    
    const threshold = parseFloat(configPercentage.replace('%', '')) / 100;
    
    if (priceChange > threshold && timestamp - windowData.lastAlert > windowMs) {
      const message = `${pair} price changed over ${(priceChange * 100).toFixed(2)}% in last ${this.formatDuration(windowMs)} and its now ${currentPrice.toFixed(6)}`;
      
      await this.triggerAlert('price_delta', pair, 'BAD', message, false);
      
      windowData.lastAlert = timestamp;
      windowData.prices = [{ price: currentPrice, timestamp }];
    }
  }

  formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 1) return `${days} days`;
    if (days > 0) return `${days} day`;
    if (hours > 1) return `${hours} hours`;
    if (hours > 0) return `${hours} hour`;
    if (minutes > 1) return `${minutes} minutes`;
    if (minutes > 0) return `${minutes} minute`;
    if (seconds > 1) return `${seconds} seconds`;
    return `${seconds} second`;
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