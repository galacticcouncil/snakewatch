# Snakewatch

**Snakewatch** is an open-source monitoring tool (and Discord bot) developed by [Galactic Council](https://github.com/galacticcouncil). Its primary purpose is to track and display real-time on-chain events — particularly cryptocurrency trades on the Hydration and Basilisk networks — in a human-readable format. Snakewatch powers the “snakewatch” and "omniwatch" discord channels of the Basilisk and Hydration community, where trades can be observed as they happens. This makes it easy for users and developers to keep an eye on network activity without manually scanning the blockchain.

## Features

- **Real-Time Trade Monitoring** – Connects to a Substrate-based blockchain and listens for swap trades as they occur.
- **Discord Integration** – Publishes updates directly to a specified Discord channel.
- **Whale Trade Alerts** – Highlights large trades based on a configurable threshold (`WHALE_AMOUNT`).
- **Multi-Network Support** – Works with Basilisk (Kusama) and Hydration (Polkadot).
- **USD Value Conversions** – Optionally converts asset amounts to an approximate USD value.
- **Metrics and Monitoring** – Exposes Prometheus metrics for analytics.
- **Extensibility** – Built on the [Polkadot.js API](https://polkadot.js.org/api/) for easy modifications and enhancements.

## Installation Guide

You can install and run Snakewatch either from source (Node.js) or using Docker.

### Install from Source (Node.js):

**Prerequisites:**  
- **Node.js** (version 18+ recommended)
- **Git** (for cloning the repository)
- **Docker & Docker Compose** (optional, for containerized deployment)

```bash
# Clone the repository
git clone https://github.com/galacticcouncil/snakewatch.git
cd snakewatch

# Install dependencies
npm install
```

### Configure Environment:
Create a `.env` file in the project root and add the necessary values:

```bash
DISCORD_TOKEN=<your_bot_token>
DISCORD_CHANNEL=<target_channel_id>
RPC_URL=wss://rpc.basilisk.cloud  # Example for Basilisk mainnet
USD_TOKEN=2  # Optional: Asset ID for USD stablecoin on target chain
WHALE_AMOUNT=100000000000  # Optional: Whale trade threshold
```

### Run Snakewatch:

```bash
npm run start
```

Alternatively, use predefined scripts for different networks:

```bash
npm run start:mainnet  # Basilisk Mainnet
npm run start:rococo   # Hydration Rococo Testnet
npm run start:test:omnipool  # Hydration Mainnet (Omnipool)
```

### Using Docker:

```bash
# Pull the Docker image
docker pull galacticcouncil/snakewatch:latest

# Run the container
docker run -d \
  -e DISCORD_TOKEN=<your_bot_token> \
  -e DISCORD_CHANNEL=<channel_id> \
  -e RPC_URL=wss://rpc.basilisk.cloud \
  -e USD_TOKEN=2 \
  -e WHALE_AMOUNT=100000000000 \
  galacticcouncil/snakewatch:latest
```

## Usage

Once running, Snakewatch autonomously listens for and posts trade events:

- **In Discord:** The bot posts messages detailing swaps (e.g., "10,000 BSX → 5 KSM (≈ $120 USD)"). Large trades may get a **whale alert**.
- **Command-Line Output:** Logs trade details and event activity.
- **Prometheus Metrics:** Exposes metrics via an HTTP endpoint for monitoring.

## Configuration

| Variable          | Description |
|------------------|-------------|
| `RPC_URL` | WebSocket URL of the blockchain node to monitor. |
| `DISCORD_TOKEN` | Discord bot authentication token. |
| `DISCORD_CHANNEL` | ID of the Discord channel for updates. |
| `USD_TOKEN` | Asset ID used for USD valuation. |
| `WHALE_AMOUNT` | Trade value threshold for whale alerts. |

## Contributing

Contributions are welcome! To contribute:

1. **Fork the repository** on GitHub.
2. **Create a new branch** for your feature or fix.
3. **Make your changes** and follow the project's coding style.
4. **Run tests** (`npm test`) and ensure the bot still functions.
5. **Submit a Pull Request (PR)** with a clear description.

## License

This project is licensed under the **Apache License 2.0**. See [`LICENSE`](https://github.com/galacticcouncil/snakewatch/blob/main/LICENSE) for details.

---

🐍🔍  S N A K E W A T C H  🔍🐍  


