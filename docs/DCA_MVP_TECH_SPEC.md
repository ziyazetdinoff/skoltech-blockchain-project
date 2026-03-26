# Technical Specification

## Project

**Title:** DCA Investing Smart Contract (Interval-Based Buying) with Automation  
**Format:** educational project, MVP  
**Document language:** English  
**Target network:** Ethereum Sepolia  
**DEX:** Uniswap  
**Interface:** Telegram bot  
**Deliverable:** code, testnet deployment, simple interface, report

---

## 1. Project Goal

Develop a minimally working system for the Dollar-Cost Averaging (DCA) strategy in which a user can create an investment plan and automatically buy one token with another at fixed time intervals.

Example scenario: a user creates a plan to buy WETH with USDC for 100 USDC every week. The funds are reserved in a smart contract, while an off-chain executor periodically checks which plans are due and triggers swap execution through Uniswap with slippage protection.

---

## 2. MVP Scope

### 2.1 What Is Included in the MVP

- A smart contract for managing DCA plans.
- Plan creation, pause, resume, cancellation, and parameter updates.
- Plan top-up and withdrawal of unused funds.
- Automatic plan execution through an off-chain executor.
- Uniswap integration for performing swaps.
- Slippage protection through `minAmountOut`.
- Deployment to Ethereum Sepolia.
- A set of unit tests.
- A simple Telegram bot for project interaction.
- A project report.

### 2.2 What Is Not Included in the MVP

- Support for multiple DEXes.
- Support for complex swap routing.
- A full web interface.
- Multi-factor authentication and production-grade secret storage.
- Platform fee logic.
- Incentives for external executors through a reward mechanism.
- A full multi-user SaaS architecture.
- Chainlink Automation in the main implementation.

---

## 3. Core Architectural Decisions

### 3.1 Selected Stack

- Smart contracts: `Solidity`
- Development and deployment environment: `Hardhat`
- Backend / automation / bot: `Node.js`
- Contract libraries: `OpenZeppelin`
- Telegram interface: Telegram Bot API
- Local backend service state storage: `SQLite` or a JSON file, depending on the implementation choice

### 3.2 Rationale

- `Hardhat` was selected because it was already used during seminars and lowers the entry barrier.
- `Node.js` works well for the Telegram bot, the executor service, and deployment scripts at the same time.
- A custom off-chain executor was chosen instead of Chainlink Automation because it is simpler for an educational MVP to implement, debug, and demonstrate.
- A Telegram bot was chosen as the simplest user interface without the need to build a frontend.

---

## 4. Key Assumptions

- The project is implemented as a **single-user demo MVP**.
- The Telegram bot and backend operate for one test user or wallet defined in configuration.
- For simplicity, the MVP uses ERC-20 tokens. `WETH` is used when demonstrating ETH purchases.
- The first version supports swaps through a single Uniswap pool (`single-hop`).
- The first version may be limited to one preconfigured pair such as `USDC -> WETH`, but the contract code should ideally not be hard-wired to only one pair.
- Gas for execution is paid by the off-chain executor.

---

## 5. MVP Business Logic

### 5.1 DCA Plan Operating Model

The user reserves the plan budget in the smart contract in advance. The contract stores the user funds and executes one purchase per interval.

Each plan contains:

- spending token (`tokenIn`)
- purchased token (`tokenOut`)
- amount per purchase (`amountPerInterval`)
- interval length in seconds
- total plan budget (`totalBudget`)
- remaining budget (`remainingBudget`)
- maximum allowed slippage (`slippageBps`)
- recipient address for the purchased asset
- start time (`startTime`)
- next execution time (`nextExecutionTime`)
- plan status

### 5.2 Funding Model

For the MVP, the chosen model is **pre-depositing the full budget**:

- the user approves the contract to spend `tokenIn`
- when the plan is created, the contract transfers `totalBudget` to its balance
- each execution spends `amountPerInterval`
- the user can top up the plan with a separate transaction
- the user can withdraw the unused remainder after cancellation, or partially if the contract logic allows it

### 5.3 Behavior for Missed Intervals

If the executor was offline and one or more intervals were missed, old intervals are not replayed. On the next available run, only one purchase is executed for the current relevant interval.

### 5.4 Behavior for Failed Swaps

If a swap fails because of:

- high slippage
- insufficient liquidity
- a temporary network issue

the execution transaction reverts and the plan remains active. The executor must retry it later.

---

## 6. Functional Requirements

### 6.1 Smart Contract Requirements

Implement a contract `DCAPlanManager` that:

- creates a new DCA plan
- stores plan parameters and budget
- allows the plan owner to pause the plan
- allows the plan owner to resume the plan
- allows the plan owner to cancel the plan
- allows the plan owner to top up the plan budget
- allows the plan owner to withdraw unused funds
- allows the plan owner to update:
  - amount per purchase
  - interval
  - slippage
- allows any caller to execute an active overdue plan
- performs the swap through the Uniswap router
- transfers the purchased asset to the recipient address
- emits events for backend processing and reporting

### 6.2 Required Plan Operations

Each plan must support the following operations:

- `create`
- `pause`
- `resume`
- `cancel`
- `top up`
- `withdraw unused funds`
- `update amount`
- `update interval`
- `update slippage`
- `execute`

### 6.3 Off-Chain Executor Requirements

The off-chain executor must:

- periodically poll the contract or a local database of active plans
- determine which plans are ready for execution
- request a swap quote from Uniswap Quoter or a similar source
- calculate `minAmountOut` using `slippageBps`
- call `executePlan`
- log successful and failed executions
- avoid automatically marking a plan as completed when an error occurs

### 6.4 Telegram Bot Requirements

The bot must provide the minimum set of user actions:

- show command help
- create a plan
- show the plan list
- show plan details
- pause a plan
- resume a plan
- cancel a plan
- top up a plan
- withdraw the remainder
- change plan parameters

The minimum command set may be implemented, for example, as:

- `/start`
- `/help`
- `/create`
- `/plans`
- `/plan <id>`
- `/pause <id>`
- `/resume <id>`
- `/cancel <id>`
- `/topup <id> <amount>`
- `/withdraw <id>`
- `/update <id>`

### 6.5 Report Requirements

The report must include:

- the problem statement
- the solution architecture
- the smart contract logic
- the automation logic
- the Telegram interface description
- the test description
- deployed contract addresses on Sepolia
- MVP limitations and possible improvements

---

## 7. Non-Functional Requirements

- The code must be readable and well-structured.
- The contract must use safe practices for working with ERC-20 tokens.
- Key actions must be covered by unit tests.
- Router, token, and private key configuration must be placed in `.env`.
- The project must run according to the instructions in `README.md`.
- The solution must remain simple enough for demonstration within an educational project.

---

## 8. System Architecture

### 8.1 Components

The system consists of four main components:

1. `DCAPlanManager`  
   The smart contract that stores plans, funds, and execution logic.

2. `Uniswap Router`  
   The external DEX contract through which the swap is performed.

3. `Executor Service`  
   A Node.js process that periodically looks for executable plans and submits transactions.

4. `Telegram Bot`  
   The interface for managing plans and viewing statuses.

### 8.2 High-Level Interaction Flow

1. The user initiates plan creation through the Telegram bot.
2. The backend forms and sends a transaction to the contract.
3. The contract reserves the budget and saves the plan.
4. The executor checks active plans on schedule.
5. For an overdue plan, the executor requests a quote and calculates `minAmountOut`.
6. The executor calls `executePlan`.
7. The contract performs the swap through Uniswap.
8. The received `tokenOut` is sent to the recipient.
9. The contract updates `remainingBudget` and `nextExecutionTime`.
10. The backend shows the updated status through the Telegram bot.

---

## 9. Smart Contract Data Model

### 9.1 Plan Entity

Recommended `Plan` structure:

```solidity
struct Plan {
    address owner;
    address recipient;
    address tokenIn;
    address tokenOut;
    uint256 amountPerInterval;
    uint256 totalBudget;
    uint256 remainingBudget;
    uint256 intervalSeconds;
    uint256 slippageBps;
    uint256 startTime;
    uint256 nextExecutionTime;
    bool active;
    bool paused;
    bool canceled;
}
```

The structure may be adjusted during implementation if it makes the logic cleaner and simpler.

### 9.2 Identification

- Each plan receives a unique `planId`.
- The contract stores a `nextPlanId` counter.
- Access to a plan is performed by `planId`.

### 9.3 Plan Statuses

A plan may be in one of the following logical states:

- `Active`
- `Paused`
- `Canceled`
- `Completed`

`Completed` may be derived, for example, when `remainingBudget < amountPerInterval`.

---

## 10. Smart Contract Interface

Below is a recommended set of top-level functions:

```solidity
function createPlan(
    address tokenIn,
    address tokenOut,
    uint256 amountPerInterval,
    uint256 totalBudget,
    uint256 intervalSeconds,
    uint256 slippageBps,
    address recipient,
    uint256 startTime
) external returns (uint256 planId);

function pausePlan(uint256 planId) external;
function resumePlan(uint256 planId) external;
function cancelPlan(uint256 planId) external;
function topUpPlan(uint256 planId, uint256 amount) external;
function withdrawUnusedFunds(uint256 planId, uint256 amount) external;
function updatePlan(
    uint256 planId,
    uint256 newAmountPerInterval,
    uint256 newIntervalSeconds,
    uint256 newSlippageBps
) external;

function canExecute(uint256 planId) external view returns (bool);

function executePlan(
    uint256 planId,
    uint256 minAmountOut,
    uint256 deadline
) external;

function getPlan(uint256 planId) external view returns (Plan memory);
```

It is acceptable to split `updatePlan` into several separate functions if that simplifies the contract and tests.

---

## 11. Smart Contract Events

The contract must emit events for at least the following actions:

```solidity
event PlanCreated(uint256 indexed planId, address indexed owner);
event PlanPaused(uint256 indexed planId);
event PlanResumed(uint256 indexed planId);
event PlanCanceled(uint256 indexed planId);
event PlanToppedUp(uint256 indexed planId, uint256 amount);
event UnusedFundsWithdrawn(uint256 indexed planId, uint256 amount);
event PlanUpdated(
    uint256 indexed planId,
    uint256 amountPerInterval,
    uint256 intervalSeconds,
    uint256 slippageBps
);
event PlanExecuted(
    uint256 indexed planId,
    uint256 amountIn,
    uint256 amountOut,
    uint256 executionTime
);
```

---

## 12. Plan Execution Logic

### 12.1 Readiness Conditions

A plan is considered ready for execution if all of the following conditions hold:

- the plan is active
- the plan is not paused
- the plan is not canceled
- `block.timestamp >= nextExecutionTime`
- `remainingBudget >= amountPerInterval`

### 12.2 Calculation of the Next Execution Time

After a successful execution:

- `remainingBudget` decreases by `amountPerInterval`
- `nextExecutionTime` moves forward by one interval relative to the current time so that old intervals are not replayed

Recommended behavior:

- if the executor arrives late, only one purchase is executed
- after execution, `nextExecutionTime = block.timestamp + intervalSeconds`

### 12.3 Slippage Protection Calculation

`minAmountOut` is not calculated fully inside the contract. For the MVP, it is computed off-chain:

1. the executor gets the expected `quoteAmountOut`
2. the executor applies `slippageBps`
3. the executor passes `minAmountOut` into `executePlan`
4. Uniswap guarantees that the swap succeeds only if the result is not lower than `minAmountOut`

---

## 13. Uniswap Integration Requirements

For the MVP, use a simple scheme:

- swap through one Uniswap router
- one `single-hop` route
- a method similar to `exactInputSingle`

MVP limitations:

- ERC-20 tokens only
- `WETH` is used for ETH exposure
- router, quoter, and token addresses are configured externally

---

## 14. MVP Security Measures

Include measures that are relatively simple to implement:

- `SafeERC20` for token handling
- `ReentrancyGuard` for sensitive functions
- plan owner checks for user-controlled operations
- a contract-level maximum allowed `slippageBps`
- `deadline` usage for swaps
- the ability for an admin to `pause` the whole contract
- validation of input parameters during plan creation and updates

Optional measures that can be added if time allows:

- whitelist of allowed tokens
- whitelist of allowed trading pairs

---

## 15. MVP Limitations

- The Telegram bot is not a production-grade wallet.
- In the demo version, storing a test private key in `.env` is acceptable.
- The solution is intended for one demo user.
- Only Uniswap and only simple routing are supported.
- There is no on-chain automatic trigger mechanism without an external service.
- There is no oracle or TWAP-level protection beyond `minAmountOut` and slippage limits.

---

## 16. Project Structure

Recommended repository structure:

```text
contracts/
  DCAPlanManager.sol

scripts/
  deploy.ts
  seed.ts

test/
  DCAPlanManager.test.ts

bot/
  index.ts
  commands/

executor/
  index.ts
  services/

config/
  tokens.ts
  networks.ts

artifacts/ or deployments/
docs/
  ENV_SETUP.md
  DCA_MVP_TECH_SPEC.md
  report/
README.md
```

---

## 17. Testing Requirements

Implementing unit tests for the key scenarios is sufficient.

Minimum test set:

- successful plan creation
- rejection of invalid plan creation
- pause and resume by the owner
- prevention of managing someone else's plan
- plan cancellation
- plan top-up
- remaining-funds withdrawal
- plan parameter updates
- successful plan execution
- inability to execute before the scheduled time
- inability to execute with insufficient remaining budget
- correct handling of missed intervals
- no state change on swap revert

---

## 18. Deployment Requirements

It is necessary to:

- prepare a deployment script in `Hardhat`
- deploy the contract to `Ethereum Sepolia`
- save the deployed contract address
- include the address in `README.md` and in the report
- provide `.env` configuration for:
  - RPC URL
  - deployer private key
  - backend/executor private key
  - Uniswap router address
  - test token addresses
  - Telegram bot token

---

## 19. Acceptance Criteria

The project is considered complete if:

- the contract compiles without errors
- unit tests run and pass
- the contract is deployed to Sepolia
- a DCA plan can be created
- a plan can be paused and resumed
- a plan can be canceled
- a plan can be topped up and unused funds can be withdrawn
- the executor automatically finds an overdue plan and attempts execution
- the swap is performed through Uniswap with `minAmountOut`
- a failed swap does not break the plan and it can be executed later
- the Telegram bot allows the main user actions
- the repository contains `README.md` with launch instructions
- the repository contains a report

---

## 20. Implementation Stages

### Stage 1. Project Setup

- initialize the Hardhat project
- add OpenZeppelin
- configure `.env`
- prepare the folder structure

### Stage 2. Smart Contract

- implement the plan structure
- implement CRUD-like plan management operations
- implement execution through Uniswap
- add events and validations

### Stage 3. Tests

- write unit tests
- fix issues found during testing

### Stage 4. Backend Automation

- implement the executor service
- implement contract polling
- implement `minAmountOut` calculation
- log execution results

### Stage 5. Telegram Bot

- create basic commands
- connect the bot to the smart contract
- display plan statuses

### Stage 6. Deployment and Documentation

- deploy to Sepolia
- record contract addresses
- prepare `README.md`
- prepare the report artifacts in `docs/report/`

---

## 21. Future Improvements

Outside the MVP scope, but appropriate to mention in the report:

- Chainlink Automation integration
- support for multiple users
- support for multiple DEXes
- web interface
- reward mechanism for public executors
- oracle and TWAP checks
- support for multiple swap routes
- profitability analytics and purchase history

---

## 22. Final MVP Statement

The goal is to implement an educational DCA system on Ethereum Sepolia consisting of the `DCAPlanManager` smart contract, a Node.js executor service, and a Telegram bot. The user must be able to reserve a budget in the contract, configure an interval-based token purchase plan through Uniswap, and rely on the backend to execute purchases automatically on schedule with slippage protection. The solution should be simple, demonstrational, covered by unit tests, and accompanied by a short report.
