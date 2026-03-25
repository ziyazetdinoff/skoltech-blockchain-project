import dotenv from "dotenv";

dotenv.config();

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }

  return value;
}

function getOptionalEnv(name: string): string | undefined {
  const value = process.env[name];
  return value && value.length > 0 ? value : undefined;
}

function getIntegerEnv(name: string, fallback?: number): number {
  const raw = getOptionalEnv(name);
  if (!raw) {
    if (fallback === undefined) {
      throw new Error(`Missing required integer env var: ${name}`);
    }

    return fallback;
  }

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid integer env var ${name}: ${raw}`);
  }

  return parsed;
}

function resolveManagerAddress(): string {
  return getOptionalEnv("DCA_MANAGER_ADDRESS") ?? getRequiredEnv("CONTRACT_ADDRESS");
}

export interface RuntimeConfig {
  rpcUrl: string;
  backendPrivateKey: string;
  dcaManagerAddress: string;
  uniswapRouter: string;
  uniswapQuoter: string;
  usdcAddress: string;
  wethAddress: string;
  poolFee: number;
  maxSlippageBps: number;
  executorPollIntervalMs: number;
  executorDeadlineSeconds: number;
  sqlitePath: string;
  networkName: string;
}

export interface BotConfig extends RuntimeConfig {
  telegramBotToken: string;
  telegramAllowedUserId: string;
}

export interface DeployConfig {
  rpcUrl: string;
  deployerPrivateKey: string;
  uniswapRouter: string;
  uniswapQuoter: string;
  usdcAddress: string;
  wethAddress: string;
  poolFee: number;
  maxSlippageBps: number;
  networkName: string;
}

export function loadRuntimeConfig(): RuntimeConfig {
  return {
    rpcUrl: getRequiredEnv("RPC_URL"),
    backendPrivateKey: getRequiredEnv("BACKEND_PRIVATE_KEY"),
    dcaManagerAddress: resolveManagerAddress(),
    uniswapRouter: getRequiredEnv("UNISWAP_ROUTER"),
    uniswapQuoter: getRequiredEnv("UNISWAP_QUOTER"),
    usdcAddress: getRequiredEnv("USDC_ADDRESS"),
    wethAddress: getRequiredEnv("WETH_ADDRESS"),
    poolFee: getIntegerEnv("UNISWAP_POOL_FEE", 500),
    maxSlippageBps: getIntegerEnv("MAX_SLIPPAGE_BPS", 1000),
    executorPollIntervalMs: getIntegerEnv("EXECUTOR_POLL_INTERVAL_MS", 30_000),
    executorDeadlineSeconds: getIntegerEnv("EXECUTOR_DEADLINE_SECONDS", 300),
    sqlitePath: getOptionalEnv("SQLITE_PATH") ?? "./data/dca.sqlite",
    networkName: getOptionalEnv("NETWORK_NAME") ?? "sepolia",
  };
}

export function loadBotConfig(): BotConfig {
  return {
    ...loadRuntimeConfig(),
    telegramBotToken: getRequiredEnv("TELEGRAM_BOT_TOKEN"),
    telegramAllowedUserId: getRequiredEnv("TELEGRAM_ALLOWED_USER_ID"),
  };
}

export function loadDeployConfig(): DeployConfig {
  return {
    rpcUrl: getRequiredEnv("RPC_URL"),
    deployerPrivateKey: getRequiredEnv("DEPLOYER_PRIVATE_KEY"),
    uniswapRouter: getRequiredEnv("UNISWAP_ROUTER"),
    uniswapQuoter: getRequiredEnv("UNISWAP_QUOTER"),
    usdcAddress: getRequiredEnv("USDC_ADDRESS"),
    wethAddress: getRequiredEnv("WETH_ADDRESS"),
    poolFee: getIntegerEnv("UNISWAP_POOL_FEE", 500),
    maxSlippageBps: getIntegerEnv("MAX_SLIPPAGE_BPS", 1000),
    networkName: getOptionalEnv("NETWORK_NAME") ?? "sepolia",
  };
}
