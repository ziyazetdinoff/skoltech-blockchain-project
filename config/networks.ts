export interface NetworkConfig {
  readonly key: string;
  readonly label: string;
  readonly chainId: number;
  readonly explorerBaseUrl: string;
}

export const NETWORKS: Record<string, NetworkConfig> = {
  sepolia: {
    key: "sepolia",
    label: "Ethereum Sepolia",
    chainId: 11155111,
    explorerBaseUrl: "https://sepolia.etherscan.io",
  },
};

export function getNetworkConfig(networkName: string): NetworkConfig {
  const config = NETWORKS[networkName];
  if (!config) {
    throw new Error(`Unsupported network: ${networkName}`);
  }

  return config;
}
