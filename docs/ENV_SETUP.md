# How to Fill in `.env` for the DCA MVP

This document explains where to obtain the main environment variables required to run the project on `Ethereum Sepolia`.

## What You Need in Advance

- a separate test wallet in MetaMask
- some `Sepolia ETH` for gas
- `USDC` on Sepolia to create a DCA plan
- an RPC endpoint for the Sepolia network

## Important Safety Rule

- do not use your main wallet
- create a separate account for testing only
- do not publish the private key on GitHub, Telegram, or in reports
- the `.env` file must remain local only

## 1. `RPC_URL`

`RPC_URL` is the HTTPS address of the Ethereum node the project uses to interact with the Sepolia network.

### Easiest Way to Get It

1. Sign up at [Alchemy](https://www.alchemy.com/chain-connect/endpoints/alchemy-sepolia).
2. Create an application:
   - Chain: `Ethereum`
   - Network: `Sepolia`
3. Copy the generated HTTPS endpoint.

### Example

```env
RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_ALCHEMY_API_KEY
```

### Where to Get Test ETH

For gas, you can use:

- [Alchemy Sepolia Faucet](https://www.alchemy.com/faucets/ethereum-sepolia)

## 2. `DEPLOYER_PRIVATE_KEY`

This is the private key of the wallet used to deploy the contract.

### How to Get It

1. Create a separate MetaMask account for testing.
2. Open the MetaMask guide:
   - [How to export an account private key](https://support.metamask.io/configure/accounts/how-to-export-an-accounts-private-key/)
3. Export the private key of that test account.
4. Paste it into `.env`.

### Example

```env
DEPLOYER_PRIVATE_KEY=0xYOUR_TEST_WALLET_PRIVATE_KEY
```

## 3. `BACKEND_PRIVATE_KEY`

Even if you were not asking about it directly, this variable is also required for the project. It is the wallet key used by:

- the executor
- the Telegram bot
- the seed script

### What to Choose

There are two options:

- use the same test wallet as for deployment
- create a second test wallet specifically for the backend

For MVP simplicity, you can temporarily use the same key:

```env
BACKEND_PRIVATE_KEY=0xYOUR_TEST_WALLET_PRIVATE_KEY
```

In that case, this wallet must hold:

- `Sepolia ETH` for gas
- `USDC` for plan creation

## 4. `UNISWAP_ROUTER`

This is the public address of the Uniswap router on Sepolia. For the current project, you need a router that supports `exactInputSingle`.

### Address

Use `SwapRouter02`:

- [Sepolia Etherscan: SwapRouter02](https://sepolia.etherscan.io/address/0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E)

```env
UNISWAP_ROUTER=0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E
```

## 5. `UNISWAP_QUOTER`

This is the public address of the Uniswap contract used to fetch a swap quote before actual execution.

### Address

Use `QuoterV2`:

- [Sepolia Etherscan: QuoterV2](https://sepolia.etherscan.io/address/0x7A0be50E2AEE679618CD61045F19E1A414De94E5)

```env
UNISWAP_QUOTER=0x7A0be50E2AEE679618CD61045F19E1A414De94E5
```

## 6. `USDC_ADDRESS`

This is the `USDC` token address on Sepolia.

### Address

For this project, use Circle's Sepolia USDC:

- [Circle docs: monitored tokens](https://developers.circle.com/wallets/monitored-tokens)
- [Circle faucet](https://faucet.circle.com/)

```env
USDC_ADDRESS=0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238
```

### How to Get Test USDC

1. Open [Circle Faucet](https://faucet.circle.com/).
2. Choose the `Ethereum Sepolia` network.
3. Enter your test wallet address.
4. Request `USDC`.

## 7. `WETH_ADDRESS`

This is the wrapped ETH (`WETH9`) address on Sepolia.

### Address

- [Sepolia Etherscan: WETH9](https://sepolia.etherscan.io/address/0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14)

```env
WETH_ADDRESS=0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14
```

## 8. `ETHERSCAN_API_KEY`

This variable is required for the separate verify step after contract deployment.

### How to Get It

1. Register at [Etherscan](https://etherscan.io/register).
2. Create an API key by following the official guide:
   - [Getting an API Key](https://docs.etherscan.io/getting-an-api-key)
3. Copy the key into `.env`.

### Example

```env
ETHERSCAN_API_KEY=YOUR_ETHERSCAN_API_KEY
```

### Where It Is Used in This Project

- `make verify`
- `npm run verify:sepolia`

## Ready-to-Use Minimal `.env`

Below is the minimum set of values you need to fill in before deployment and launch:

```env
RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_ALCHEMY_API_KEY

DEPLOYER_PRIVATE_KEY=0xYOUR_TEST_WALLET_PRIVATE_KEY
BACKEND_PRIVATE_KEY=0xYOUR_TEST_WALLET_PRIVATE_KEY

UNISWAP_ROUTER=0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E
UNISWAP_QUOTER=0x7A0be50E2AEE679618CD61045F19E1A414De94E5

USDC_ADDRESS=0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238
WETH_ADDRESS=0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14

ETHERSCAN_API_KEY=YOUR_ETHERSCAN_API_KEY
```

After the contract is deployed, add one more variable:

```env
DCA_MANAGER_ADDRESS=0xYOUR_DEPLOYED_CONTRACT_ADDRESS
```

or

```env
CONTRACT_ADDRESS=0xYOUR_DEPLOYED_CONTRACT_ADDRESS
```

## What the Wallet Must Hold Before Launch

The wallet specified in `BACKEND_PRIVATE_KEY` must hold:

- `Sepolia ETH` for gas
- `USDC` for creating a DCA plan

The wallet specified in `DEPLOYER_PRIVATE_KEY` must hold:

- `Sepolia ETH` for deployment

If both variables point to the same test wallet, that wallet must hold:

- `Sepolia ETH`
- `USDC`

## Common Problems

### 1. `insufficient funds for intrinsic transaction cost`

Cause: the wallet has no `Sepolia ETH`.

What to do:

- get test ETH from a faucet

### 2. Quote or Swap Fails

The usual reasons are one of the following:

- there is not enough liquidity in the selected pool
- `UNISWAP_POOL_FEE` is incorrect
- the wallet has no `USDC`

For this project, the default value is:

```env
UNISWAP_POOL_FEE=500
```

If the swap still fails, it is worth checking the `3000` option as well.

### 3. The Contract Was Deployed but the Bot and Executor Cannot See It

Cause: the deployed contract address was not written to `.env`.

What to do:

- copy the address from the output of `make deploy` or `npm run deploy:sepolia`
- save it as `DCA_MANAGER_ADDRESS` or `CONTRACT_ADDRESS`

## Practical Order of Actions

1. Create a separate test wallet in MetaMask.
2. Get `Sepolia ETH` from a faucet.
3. Get `USDC` from Circle Faucet.
4. Create a Sepolia endpoint in Alchemy and copy `RPC_URL`.
5. Export the private key of the test wallet.
6. Fill in `.env`.
7. Run deployment:

```bash
make deploy
```

8. Copy the contract address into `.env`.
9. Run verification:

```bash
make verify
```

10. Start the executor and the bot.

## Sources

- [Alchemy Sepolia endpoints](https://www.alchemy.com/chain-connect/endpoints/alchemy-sepolia)
- [Alchemy Sepolia faucet](https://www.alchemy.com/faucets/ethereum-sepolia)
- [MetaMask: export private key](https://support.metamask.io/configure/accounts/how-to-export-an-accounts-private-key/)
- [Sepolia Etherscan: SwapRouter02](https://sepolia.etherscan.io/address/0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E)
- [Sepolia Etherscan: QuoterV2](https://sepolia.etherscan.io/address/0x7A0be50E2AEE679618CD61045F19E1A414De94E5)
- [Sepolia Etherscan: WETH9](https://sepolia.etherscan.io/address/0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14)
- [Circle docs: monitored tokens](https://developers.circle.com/wallets/monitored-tokens)
- [Circle faucet](https://faucet.circle.com/)
- [Etherscan: Getting an API Key](https://docs.etherscan.io/getting-an-api-key)
