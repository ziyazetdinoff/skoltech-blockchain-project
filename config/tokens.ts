import { RuntimeConfig } from "../src/common/env";

export interface DemoTokenConfig {
  readonly symbol: string;
  readonly address: string;
}

export interface DemoPairConfig {
  readonly tokenIn: DemoTokenConfig;
  readonly tokenOut: DemoTokenConfig;
}

export function getDemoPairConfig(config: Pick<RuntimeConfig, "usdcAddress" | "wethAddress">): DemoPairConfig {
  return {
    tokenIn: {
      symbol: "USDC",
      address: config.usdcAddress,
    },
    tokenOut: {
      symbol: "WETH",
      address: config.wethAddress,
    },
  };
}
