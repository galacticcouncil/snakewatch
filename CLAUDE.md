# SnakeWatch - Development Guide

## Commands
- **Start bot**: `npm start`
- **Run tests**: `npm test`
- **Run single test**: `npm test -- -t "test name"` 
- **Debug**: Add console.log statements for debugging (no formal linting)

## Code Style
- **Format**: Modern JavaScript with ES modules
- **Imports**: Use named imports/exports
- **Architecture**: Event-driven with specialized handlers
- **Naming**: camelCase for variables/functions, PascalCase for classes
- **Functions**: Prefer arrow functions with destructured parameters
- **Async**: Use async/await for promises
- **Error handling**: Try/catch blocks for operations that may fail
- **Performance**: Memoize expensive operations where appropriate
- **Types**: No formal typing system, use JSDoc when needed
- **Comments**: Add comments for complex logic or non-obvious behavior

## Project Structure
- **src/handlers/**: Specialized handlers for different blockchain events
- **src/utils/**: Shared utility functions
- **src/resources/**: ABI definitions and other resources
- **tests/**: Jest test files

## Alerts System
The bot includes a comprehensive alerts system for Slack notifications. See **ALERTS.md** for detailed configuration instructions.

### Quick Setup
```bash
# Required: Slack webhook URL
ALERT_WEBHOOK_SLACK="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"

# Optional: Health factor monitoring
ALERT_HF='[["account_address", 1.01]]'

# Optional: Interest rate monitoring
ALERT_RATE='[["DOT", "borrow", "5%"], ["GDOT", "supply", "10%"]]'

# Optional: Price delta monitoring
ALERT_PRICE_DELTA='[["GDOT/DOT", "5%", "10m"]]'
```

The alerts system is initialized automatically when the bot starts. For complete configuration options, troubleshooting, and examples, see **ALERTS.md**.