# DCA MVP for Ethereum Sepolia

We built this project as a three-person team to deliver an educational MVP for Dollar-Cost Averaging on Ethereum Sepolia. Our goal was to combine an on-chain DCA manager, an off-chain automation service, and a simple Telegram interface into one end-to-end demo system.

<!-- DEPLOYMENT_INFO:START -->
## Deployment Info

- Network: sepolia
- Contract: `DCAPlanManager`
- Address: `0x3BBfFa934e619E7fAcE878dAEe8da5664eEC45f5`
- Explorer: [address](https://sepolia.etherscan.io/address/0x3BBfFa934e619E7fAcE878dAEe8da5664eEC45f5)
- Code: [verified/source](https://sepolia.etherscan.io/address/0x3BBfFa934e619E7fAcE878dAEe8da5664eEC45f5#code)
- Deploy tx: `0x4d30b90e5297eb4002822454571f85ef8a02f8261d365af8cc477797bd028662`
- Deployer: `0x1ac4c1e133c71FC72cf8Da0427d3eA06549e3Aa1`
- Deployed at: 2026-03-25T20:34:24.815Z
- Verified: no
- Verified at: not verified yet
<!-- DEPLOYMENT_INFO:END -->

## What Our Team Implemented

- a Solidity smart contract: `DCAPlanManager`
- Uniswap V3 single-hop swap execution through `exactInputSingle`
- slippage protection via `minAmountOut`
- an off-chain executor that scans plans, requests quotes, executes due plans, and stores logs in SQLite
- a Telegram bot for plan management
- deployment and seeding scripts
- unit tests for the contract and backend utilities

## Project Structure

```text
contracts/
  DCAPlanManager.sol
  interfaces/ISwapRouter.sol
  mocks/

scripts/
  deploy.ts
  seed.ts

test/
  DCAPlanManager.test.ts
  backend.test.ts

bot/
  index.ts
  commands/registerCommands.ts
  services/

executor/
  index.ts
  services/

config/
  tokens.ts
  networks.ts

src/
  common/
  storage/

deployments/
  sepolia.json
Dockerfile
docker-compose.yml
Makefile
README.md
README_ENG.md
ENV_SETUP.md
report.md
```

## Tech Stack

As a team, we chose a simple and practical MVP stack:

- Solidity for the smart contract
- Hardhat + TypeScript for development, testing, and deployment
- Node.js for the executor and Telegram bot
- SQLite for local backend state and execution logs
- Uniswap V3 for swap execution
- Telegram Bot API through `telegraf`

## MVP Scope

In our implementation, a user can:

- create a DCA plan
- pause and resume it
- cancel it
- top up the budget
- withdraw unused funds after cancellation
- update amount, interval, and slippage
- let the executor automatically execute due swaps

This MVP is intentionally limited to:

- one demo user
- one demo trading pair at the UX level: `USDC -> WETH`
- Uniswap V3 single-hop execution
- Sepolia testnet only

## Environment Requirements

- Node.js 22 LTS is recommended
- npm 10+
- a Sepolia RPC endpoint
- Sepolia ETH for gas
- Sepolia USDC for plan funding
- a Telegram bot token

Hardhat compiled and tested successfully in our environment, but Node.js 23 shows a warning because Hardhat officially prefers supported LTS versions. For normal use, we recommend Node.js 22.

## Environment Variables

Copy `.env.example` into `.env`:

```bash
cp .env.example .env
```

Required values:

- `RPC_URL`
- `DEPLOYER_PRIVATE_KEY`
- `BACKEND_PRIVATE_KEY`
- `UNISWAP_ROUTER`
- `UNISWAP_QUOTER`
- `USDC_ADDRESS`
- `WETH_ADDRESS`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_ALLOWED_USER_ID`

For verification, we also need:

- `ETHERSCAN_API_KEY`

After deployment, also set:

- `DCA_MANAGER_ADDRESS`

or:

- `CONTRACT_ADDRESS`

Default optional values:

- `UNISWAP_POOL_FEE=500`
- `MAX_SLIPPAGE_BPS=1000`
- `EXECUTOR_POLL_INTERVAL_MS=30000`
- `EXECUTOR_DEADLINE_SECONDS=300`
- `SQLITE_PATH=./data/dca.sqlite`
- `NETWORK_NAME=sepolia`

For a beginner-friendly explanation of where these values come from, see:

- [ENV_SETUP.md](/Users/ruslan/cur-anime-dir/skoltech-blockchain-project/ENV_SETUP.md)

## Installation

```bash
npm install
```

## Docker and Makefile

We now treat Docker as the primary way to run the project:

```bash
make build-image
make compile
make test
```

Main targets:

- `make build-image`
- `make compile`
- `make test`
- `make deploy`
- `make verify`
- `make seed SEED_ARGS="10 100 604800 300 me now"`
- `make up`
- `make down`
- `make logs`

Equivalent Docker Compose commands:

```bash
docker compose build
docker compose run --rm hardhat npm run compile
docker compose run --rm hardhat npm test
docker compose run --rm hardhat npm run deploy:sepolia
docker compose run --rm hardhat npm run verify:sepolia
docker compose up -d bot executor
```

## Build and Test

```bash
npm run build
npm run compile
npm test
```

If Hardhat cannot use the default home directory in your environment, run it with a local `HOME`:

```bash
mkdir -p .home
HOME=$PWD/.home npm run compile
HOME=$PWD/.home npm test
```

## Deploy to Sepolia

From our team workflow perspective, deployment is done in four steps:

1. Fill in `.env` with RPC, private key, router, quoter, and token addresses.
2. Run:

```bash
npm run deploy:sepolia
```

3. Read the deployed contract address from terminal output.
4. Save that address into `.env` as `DCA_MANAGER_ADDRESS` or `CONTRACT_ADDRESS`.

The script also stores deployment metadata in:

- `deployments/sepolia.json`

It also auto-updates the deployment info block in:

- `README.md`
- `README_ENG.md`

Recommended command:

```bash
make deploy
```

## Verify on Etherscan

Verification is intentionally separated from deployment. The verify step uses:

- `ETHERSCAN_API_KEY` from `.env`
- the deployed address and constructor arguments from `deployments/sepolia.json`

Run:

```bash
make verify
```

Or directly:

```bash
docker compose run --rm hardhat npm run verify:sepolia
```

After successful verification:

- `deployments/sepolia.json` is updated with `verified` and `verifiedAt`
- both README deployment info blocks are refreshed

## Create a Demo Plan

We added `seed.ts` so our team could quickly demonstrate the full flow without typing every transaction manually.

Usage:

```bash
npm run seed:sepolia -- <amountPerInterval> <totalBudget> <intervalSeconds> <slippageBps> [recipient] [startTime]
```

Example:

```bash
npm run seed:sepolia -- 10 100 604800 300 me now
```

Arguments:

- `amountPerInterval`: amount spent on each purchase in USDC
- `totalBudget`: total reserved budget in USDC
- `intervalSeconds`: execution interval in seconds
- `slippageBps`: allowed slippage in basis points
- `recipient`: recipient address or `me`
- `startTime`: `now`, Unix timestamp, or ISO datetime

## Run the Executor

```bash
npm run executor
```

The executor:

- scans all `planId` values from `0` to `nextPlanId - 1`
- syncs plan snapshots into SQLite
- checks `canExecute`
- requests a quote from Uniswap Quoter
- calculates `minAmountOut`
- calls `executePlan`
- stores execution attempts and logs

For a single one-off run:

```bash
node --import tsx executor/index.ts --once
```

## Run the Telegram Bot

```bash
npm run bot
```

Supported commands:

- `/start`
- `/help`
- `/plans`
- `/plan <id>`
- `/pause <id>`
- `/resume <id>`
- `/cancel <id>`
- `/topup <id> <amount>`
- `/withdraw <id> <amount>`
- `/create`
- `/update <id>`

For `/plan <id>`, the bot now shows inline buttons:

- `Pause`
- `Resume`
- `Cancel`
- `Refresh`

The original slash commands remain fully supported.

Interactive `/create` flow:

1. `amountPerInterval`
2. `totalBudget`
3. `intervalSeconds`
4. `slippageBps`
5. `recipient`
6. `startTime`

Interactive `/update` flow:

1. `amountPerInterval`
2. `intervalSeconds`
3. `slippageBps`

The bot is restricted to one allowed Telegram user through `TELEGRAM_ALLOWED_USER_ID`.

## Demo Flow

This is the shortest end-to-end flow our team used for verification:

1. Install dependencies.
2. Fill `.env`.
3. Deploy the contract with `npm run deploy:sepolia`.
4. Save the deployed contract address in `.env`.
5. Create a demo plan with `npm run seed:sepolia -- 10 100 604800 300 me now` or through `/create`.
6. Start the executor with `npm run executor`.
7. Start the bot with `npm run bot`.
8. Verify plans through `/plans` and `/plan <id>`.

## Acceptance Summary

From our team’s implementation perspective, the delivered MVP includes:

- contract plan lifecycle management
- automated execution attempts
- Uniswap-based swaps with slippage protection
- SQLite-backed service state
- Telegram-based user interaction
- tests and deployment tooling
- project documentation in Russian and English

## Known Limitations

- single-user demo architecture
- one demo pair in UX and configuration
- no production-grade secret management
- no Chainlink Automation
- no advanced routing across multiple pools or DEXes
- no oracle or TWAP validation beyond `minAmountOut`

## Additional Documents

- [README.md](/Users/ruslan/cur-anime-dir/skoltech-blockchain-project/README.md)
- [ENV_SETUP.md](/Users/ruslan/cur-anime-dir/skoltech-blockchain-project/ENV_SETUP.md)
- [report.md](/Users/ruslan/cur-anime-dir/skoltech-blockchain-project/report.md)
