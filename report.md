# Report: DCA MVP on Ethereum Sepolia

## 1. Problem Statement

The goal of the project is to deliver an educational MVP for interval-based DCA investing, where a user reserves a budget in a smart contract and an off-chain executor automatically performs scheduled token purchases through Uniswap with slippage protection. The user interface is implemented as a Telegram bot.

## 2. Solution Architecture

The system consists of three main modules:

- `DCAPlanManager` stores plans, budgets, management rules, and on-chain execution logic
- `Executor Service` periodically scans plans, calculates `minAmountOut`, and calls `executePlan`
- `Telegram Bot` manages plans and shows their status to the user

SQLite is additionally used for local plan snapshots, execution attempt history, and service logs for backend components.

## 3. Smart Contract Logic

The contract supports:

- plan creation
- pause and resume
- cancellation
- budget top-ups
- withdrawal of unused funds after cancellation
- plan parameter updates
- automated execution by any caller when `canExecute` conditions are satisfied

Each plan stores:

- the owner and recipient
- `tokenIn` and `tokenOut`
- `amountPerInterval`
- `totalBudget` and `remainingBudget`
- `intervalSeconds`
- `slippageBps`
- `startTime`
- `nextExecutionTime`
- boolean flags `active`, `paused`, `canceled`

Execution is implemented through Uniswap V3 `exactInputSingle`. After a successful swap, the contract:

- decreases `remainingBudget`
- moves `nextExecutionTime` to `block.timestamp + intervalSeconds`
- transfers the purchased `tokenOut` to the recipient

This behavior does not catch up missed intervals, which matches the MVP specification.

## 4. Automation Logic

The executor:

- reads `nextPlanId`
- iterates over all plans
- synchronizes snapshots into SQLite
- checks `canExecute`
- requests a quote from Uniswap Quoter
- calculates `minAmountOut` using `slippageBps`
- submits `executePlan`
- logs successes and failures

If the swap reverts, the on-chain plan state remains unchanged, and the executor simply records the error and can retry in the next cycle.

## 5. Telegram Interface

The bot supports the following commands:

- `/plans`, `/plan <id>`
- `/pause <id>`, `/resume <id>`, `/cancel <id>`
- `/topup <id> <amount>`
- `/withdraw <id> <amount>`
- `/create`
- `/update <id>`

For `/create` and `/update`, guided step-by-step input is implemented to reduce manual input errors.

## 6. Tests

Unit tests are implemented for the contract and backend utilities.

Covered contract scenarios:

- successful creation
- rejection of invalid creation
- owner-only operations
- pause and resume
- cancellation and remaining-funds withdrawal
- top-up and parameter updates
- successful execution
- prevention of early execution
- plan completion when the remaining budget is insufficient
- correct handling of missed intervals
- state rollback on swap revert
- global pause

Covered backend scenarios:

- `minAmountOut` calculation
- plan status derivation
- persistence of snapshots and execution attempts in SQLite

## 7. Deployment Addresses

At the time of preparing this report, automatic Sepolia deployment was not performed from the report environment because working secrets and RPC configuration were not provided there.

After deployment, fill in:

- `DCAPlanManager (Sepolia): TBD`
- `Deployment metadata file: deployments/sepolia.json`

## 8. MVP Limitations

- single-user demo
- one demo pair `USDC -> WETH`
- Uniswap V3 single-hop only
- no production-grade secret management
- no Chainlink Automation
- no multi-user SaaS logic
- no oracle or TWAP checks beyond `minAmountOut`

## 9. Possible Improvements

- Chainlink Automation
- support for multiple pairs and multiple users
- web UI
- reward mechanism for external executors
- stricter risk checks and oracle-based validation
