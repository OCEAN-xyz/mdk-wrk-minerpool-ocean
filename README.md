# mdk-wrk-minerpool-ocean

Ocean Mining Pool Worker - mdk worker implementation for integrating with Ocean.xyz mining pool API.

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Installation](#installation)
4. [Configuration](#configuration)
5. [Starting the Worker](#starting-the-worker)
6. [Running under MDK](#running-under-mdk)
7. [Architecture](#architecture)
8. [API Endpoints Used](#api-endpoints-used)
9. [Development](#development)
10. [Monitoring](#monitoring)
11. [Troubleshooting](#troubleshooting)
12. [Contributing](#contributing)

## Overview

This worker connects to the Ocean mining pool API to collect and monitor mining statistics, including:
- Real-time hashrate monitoring (60s, 1h, 24h intervals)
- Worker status and performance tracking
- Earnings and payout tracking
- Transaction history
- Block statistics and pool luck calculations
- Monthly earnings reports

## Prerequisites

- Node.js >= 20.0
- Valid Ocean account username for production use

## Installation

1. Clone the repository:
```bash
git clone https://github.com/ocean-xyz/mdk-wrk-minerpool-ocean.git
cd mdk-wrk-minerpool-ocean
```

2. Install dependencies:
```bash
npm install
```

3. Setup configuration files:
```bash
bash setup-config.sh
```

## Configuration

### Base Configuration (config/ocean.json)

Configure the Ocean API endpoint:

Development/Staging:
json
{
  "apiUrl": "http://127.0.0.1:8000",
  "accounts":["account-id-1"]
}

Production:
json
{
  "apiUrl": "https://api.ocean.xyz",
  "accounts":["account-id-1"]
}

## Starting the Worker

### Production Mode
```bash
DEBUG="*" node worker.js --wtype wrk-minerpool-rack-ocean --env production --rack rack-1
```

### Development Mode
```bash
DEBUG="*" node worker.js --wtype wrk-minerpool-rack-ocean --env development --rack rack-1
```

### Mock Server (Development)
```bash
DEBUG="*" node mock/server.js
```

## Running under MDK

The worker can also be hosted on the [MDK](https://docs.mdk.tether.io/concepts/architecture/) `WorkerRuntime` (v1),
so an MDK Kernel can discover it and pull its telemetry. The MiningOS worker class is unchanged and its MiningOS RPC
server (`getWrkExtData`) keeps running next to the runtime, so existing orks are unaffected.

### Install MDK

`@tetherto/mdk` is not published to npm; it is a git dependency (pinned in `package.json`). npm does not install a
git dependency's workspace packages, so after `npm install` run once:

```bash
npm run setup:mdk
```

MiningOS-only deployments (`worker.js`) never load MDK and can skip this step.

### Start

Uses the same `config/` files as `worker.js`:

```bash
# Join the Kernel's DHT discovery topic
node mdk.js --env production --rack rack-1 --topic <kernel-topic-hex>

# Or, on the Kernel's machine, publish the runtime key for local discovery
node mdk.js --env production --rack rack-1 --keys-dir <kernel-root>/.worker-keys
```

`--worker-id` defaults to `wrk-minerpool-rack-ocean-<rack>`. With neither `--topic` nor `--keys-dir`, pass the printed
runtime key to `kernel.registerWorker()`.

| Option | Required | Description |
| --- | --- | --- |
| `workerId` | Yes | Runtime worker ID; also the ID of the single pool device |
| `rack` | Yes | Same as `--rack` on `worker.js` |
| `root` | No | Service root holding `config/` and `status/` (default: this package). Stores are created relative to the working directory, as with `worker.js` |
| `env` | No | Config environment (default `production`) |
| `kernelTopic` | No | Kernel DHT discovery topic (hex) |
| `bootstrap` | No | DHT bootstrap override (tests) |
| `WorkerRuntime` | No | Runtime class to use instead of the one from `@tetherto/mdk` |

### Telemetry

The pool is exposed as one device whose ID is the `workerId`.

| Field | Unit | Description |
| --- | --- | --- |
| `hashrate` | H/s | Pool-side hashrate across accounts (60s window) |
| `workers_online` | | Workers hashing (non-zero 600s hashrate) across accounts |
| `balance` | BTC | Unpaid earnings across accounts |
| `estimated_earnings` | BTC | Estimated earnings for the next pool block across accounts |

Every `getWrkExtData` key (`stats`, `stats-history`, `workers`, `blocks`, `transactions`, `datum-stats`, `alerts`, ...)
is available through the runtime's `ext_data` telemetry type, e.g. `client.pullTelemetry(workerId, { type: 'ext_data', key: 'stats' })`.

## Architecture

### Core Classes

#### `OceanMinerPoolApi` (`workers/lib/ocean.minerpool.api.js`)
Thin API wrapper class that handles:
- API communication with Ocean.xyz endpoints
- Rate limiting (1 second between requests)
- Request formatting and response parsing
- Minimal error handling (HTTP facility handles retries)

#### `WrkMinerPoolRackOcean` (`workers/ocean.rack.minerpool.wrk.js`)
Main worker class extending `TetherWrkBase` that:
- Initializes HTTP facilities for Ocean API communication
- Schedules periodic data collection:
  - Every 1 minute: Fetch stats (hashrate, earnings, balances)
  - Every 5 minutes: Fetch workers and save stats to database
  - Daily: Fetch transactions and blocks
- Implements data aggregation and storage logic
- Manages multiple mining accounts via configuration
- Provides RPC interface for querying collected data

### Statistics Collection

The worker collects and stores various statistics:

1. **Real-time Stats** (every 5 minutes):
   - Worker count and status
   - Hashrate (60s, 1h, 24h averages)
   - Active worker count
   - Daily transactions

2. **Daily Stats**:
   - Block information
   - Network difficulty
   - Pool shares and luck calculations
   - Earnings per block

3. **Monthly Stats**:
   - Aggregated earnings
   - Pool luck percentages
   - Historical performance

### Data Flow

1. Worker connects to Ocean API using configured credentials
2. Periodically fetches mining statistics based on schedules
3. Processes and aggregates data
4. Stores statistics for historical tracking
5. Provides data via RPC interface

## API Endpoints Used

The worker interacts with the following Ocean API endpoints:
- `/v1/earnpay/{username}/{timestamp}` - Earnings and payouts
- `/v1/user_hashrate/{username}` - Current hashrate information
- `/v1/user_hashrate_full/{username}` - Detailed worker statistics
- `/v1/monthly_earnings_report/{username}/{month}` - Monthly earnings
- `/v1/blocks` - Pool block information

## Development

### Running Tests
```bash
npm run setup:mdk   # Once, for the MDK integration test
npm run lint        # Check code style
npm run lint:fix    # Fix code style issues
npm run test    
```

## Monitoring

Monitor worker activity through debug logs:
- API requests and responses
- Statistics collection cycles
- Worker status updates
- Error messages and stack traces

## Troubleshooting

### Common Issues

1. **Registration fails**
   - Ensure username is valid for production
   - Check network connectivity to API endpoint
   - Verify configuration file syntax

2. **No statistics collected**
   - Confirm worker is running (`DEBUG="*"` shows activity)
   - Check API endpoint configuration
   - Verify thing registration was successful

3. **Rate limit errors**
   - Worker implements 1-second delays between requests
   - Multiple workers may need staggered start times

4. **Missing configuration**
   - Run `setup-config.sh` to create config files
   - Check all required fields are populated

## Contributing

Contributions are welcome and appreciated!
Whether you’re fixing a bug, adding a feature, improving documentation, or suggesting an idea, here’s how you can help:

### How to Contribute

1. **Fork** the repository.
2. **Create a new branch** for your feature or fix:

   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **Make your changes** and commit them with a clear message.
4. **Push** to your fork:

   ```bash
   git push origin feature/your-feature-name
   ```
5. **Open a Pull Request** describing what you changed and why.

### Guidelines

* Follow the existing code style and structure.
* Keep PRs focused—one feature or fix per pull request.
* Provide screenshots or examples if your change affects the UI/UX.
* Update documentation/tests as needed.
