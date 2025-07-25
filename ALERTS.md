# Alerts System Configuration

The SnakeWatch alerts system provides real-time monitoring and Slack notifications for various blockchain events. It supports three types of alerts: health factor monitoring, interest rate monitoring, and price delta monitoring.

## Quick Start

1. Set up your Slack webhook URL
2. Configure alert conditions via environment variables
3. Start SnakeWatch - alerts will be initialized automatically

## Environment Variables

### ALERT_WEBHOOK_SLACK (Required)
**Type:** URL string  
**Purpose:** Slack webhook endpoint for sending alert notifications

```bash
ALERT_WEBHOOK_SLACK="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
```

### ALERT_HF (Health Factor Monitoring)
**Type:** JSON array of `[account, threshold]` pairs  
**Purpose:** Monitor account health factors and alert when they drop below thresholds

```bash
ALERT_HF='[["12xgGUHYjGRxFxbvdmC24RbBKwnhWnhjUtZ121whCfFk4w59", 1.01], ["another_account", 1.05]]'
```

**Alert Behavior:**
- **🚨 TRIGGERED**: When account health factor < configured threshold
- **✅ RESOLVED**: When account health factor >= configured threshold

### ALERT_RATE (Interest Rate Monitoring)
**Type:** JSON array of `[reserve, type, rate]` triples  
**Purpose:** Monitor annual percentage yields (APY) and alert when they exceed thresholds

```bash
ALERT_RATE='[["DOT", "borrow", "5%"], ["GDOT", "supply", "10%"], ["USDT", "borrow", "8%"]]'
```

**Rate Types:**
- `"borrow"` - Variable borrowing rates (APY with compounding)
- `"supply"` - Liquidity supply rates (APY with compounding)

**Alert Behavior:**
- **Borrow rates**: 🚨 TRIGGERED when APY > threshold, ✅ RESOLVED when APY <= threshold
- **Supply rates**: 🚨 TRIGGERED when APY < threshold, ✅ RESOLVED when APY >= threshold

**Technical Note:** Rates are automatically converted from AAVE's Ray format (27 decimals) to APR, then converted to APY using continuous compounding (`APY = e^(APR) - 1`) to accurately reflect AAVE's block-by-block interest accrual.

### ALERT_PRICE_DELTA (Price Change Monitoring)
**Type:** JSON array of `[pair, percentage, window]` triples  
**Purpose:** Monitor price changes over time windows and alert on significant moves

```bash
ALERT_PRICE_DELTA='[["GDOT/DOT", "5%", "10m"], ["GDOT/USDT", "10%", "1m"], ["DOT/USDT", "15%", "1h"]]'
```

**Time Window Format:**
- `s` - seconds (e.g., "30s")
- `m` - minutes (e.g., "10m")
- `h` - hours (e.g., "2h")
- `d` - days (e.g., "1d")

**Alert Behavior:**
- **🚨 TRIGGERED**: When price changes more than specified percentage within time window
- **Auto-reset**: Time window resets after each trigger (no explicit resolution notification)

## Complete Configuration Example

```bash
# Slack webhook (required)
ALERT_WEBHOOK_SLACK="https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX"

# Health factor monitoring
ALERT_HF='[
  ["12xgGUHYjGRxFxbvdmC24RbBKwnhWnhjUtZ121whCfFk4w59", 1.01],
  ["5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty", 1.05],
  ["5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY", 1.02]
]'

# Interest rate monitoring
ALERT_RATE='[
  ["DOT", "borrow", "5%"],
  ["GDOT", "supply", "10%"],
  ["USDT", "borrow", "8%"],
  ["HDX", "supply", "15%"]
]'

# Price delta monitoring
ALERT_PRICE_DELTA='[
  ["GDOT/DOT", "5%", "10m"],
  ["GDOT/USDT", "10%", "1m"],
  ["DOT/USDT", "15%", "1h"],
  ["HDX/USDT", "20%", "30m"]
]'
```

## Alert Message Format

### Health Factor Alerts
```
🚨 **ALERT TRIGGERED** - Account 12xg...k4w59 health factor 0.950 < 1.01
✅ **ALERT RESOLVED** - Account 12xg...k4w59 health factor 1.050 >= 1.01
```

### Interest Rate Alerts
```
🚨 **ALERT TRIGGERED** - DOT borrow rate 6.54% APY exceeds threshold 5%
✅ **ALERT RESOLVED** - DOT borrow rate 4.08% APY within threshold 5%
```

### Price Delta Alerts
```
🚨 **ALERT TRIGGERED** - GDOT/DOT price changed 6.00% (1.000000 → 1.060000) in 10m
```

## Monitoring & Management

### API Endpoints

The alerts system provides HTTP endpoints for monitoring:

#### Active Alerts
```bash
GET /alerts/active
```
Returns current active alerts and configurations.

#### Alert History
```bash
GET /alerts/history
```
Returns recent alert history (last 100 entries).

#### Configuration
```bash
GET /alerts/config
```
Returns current alert configurations.

### Prometheus Metrics

The alerts system exposes metrics for monitoring:

- `alerts_active_alerts` - Number of currently active alerts by type
- `alerts_alert_triggers_total` - Total number of alert triggers by type and state
- `alerts_webhook_notifications_total` - Total webhook notifications sent
- `alerts_alert_history_size` - Size of alert history

## Technical Details

### Alert States
- **PENDING**: Alert condition not met
- **TRIGGERED (BAD)**: Alert condition met, notification sent
- **RESOLVED (GOOD)**: Alert condition no longer met, resolution notification sent

### Deduplication
The system prevents duplicate alerts for the same condition. An alert will only trigger once until it's resolved.

### Error Handling
- Webhook failures are logged but don't stop the system
- Network errors are handled gracefully
- Invalid configurations are logged with errors

### Memory Management
- Alert history is limited to 1000 entries (auto-pruned to 500 when limit reached)
- Price windows maintain only necessary data points within the configured time window
- Active alerts are stored in memory for fast access

## Troubleshooting

### Common Issues

#### Webhook Not Working
```bash
# Check webhook URL format
echo $ALERT_WEBHOOK_SLACK

# Test webhook manually
curl -X POST -H 'Content-type: application/json' \
  --data '{"text":"Test message"}' \
  $ALERT_WEBHOOK_SLACK
```

#### Invalid JSON Configuration
```bash
# Validate JSON format
echo $ALERT_HF | jq .
echo $ALERT_RATE | jq .
echo $ALERT_PRICE_DELTA | jq .
```

#### No Alerts Triggering
1. Check that conditions are actually met
2. Verify account addresses and asset symbols are correct
3. Check logs for configuration errors
4. Ensure webhook URL is accessible

## Integration Examples

### Docker Compose
```yaml
version: '3.8'
services:
  snakewatch:
    image: snakewatch
    environment:
      - ALERT_WEBHOOK_SLACK=https://hooks.slack.com/services/...
      - ALERT_HF=[["account1", 1.01], ["account2", 1.05]]
      - ALERT_RATE=[["DOT", "borrow", "5%"]]
      - ALERT_PRICE_DELTA=[["GDOT/DOT", "5%", "10m"]]
```

### Kubernetes ConfigMap
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: snakewatch-alerts
data:
  ALERT_WEBHOOK_SLACK: "https://hooks.slack.com/services/..."
  ALERT_HF: '[["account1", 1.01], ["account2", 1.05]]'
  ALERT_RATE: '[["DOT", "borrow", "5%"]]'
  ALERT_PRICE_DELTA: '[["GDOT/DOT", "5%", "10m"]]'
```
