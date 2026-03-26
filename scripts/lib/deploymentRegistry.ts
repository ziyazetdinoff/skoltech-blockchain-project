import fs from "node:fs/promises";
import path from "node:path";
import { getNetworkConfig } from "../../config/networks";

export interface DeploymentRecord {
  network: string;
  chainId: number;
  contract: string;
  address: string | null;
  deployer: string | null;
  deploymentTxHash: string | null;
  uniswapRouter: string | null;
  uniswapQuoter: string | null;
  usdcAddress: string | null;
  wethAddress: string | null;
  poolFee: number | null;
  maxSlippageBps: number | null;
  deployedAt: string | null;
  verified: boolean;
  verifiedAt: string | null;
  explorerAddressUrl: string | null;
  explorerCodeUrl: string | null;
}

const DEPLOYMENT_INFO_START = "<!-- DEPLOYMENT_INFO:START -->";
const DEPLOYMENT_INFO_END = "<!-- DEPLOYMENT_INFO:END -->";

function deploymentPath(networkName: string): string {
  return path.join(process.cwd(), "deployments", `${networkName}.json`);
}

function explorerAddressUrl(networkName: string, address: string): string {
  const network = getNetworkConfig(networkName);
  return `${network.explorerBaseUrl}/address/${address}`;
}

function explorerCodeUrl(networkName: string, address: string): string {
  const network = getNetworkConfig(networkName);
  return `${network.explorerBaseUrl}/address/${address}#code`;
}

export function createEmptyDeploymentRecord(networkName: string): DeploymentRecord {
  const network = getNetworkConfig(networkName);
  return {
    network: network.key,
    chainId: network.chainId,
    contract: "DCAPlanManager",
    address: null,
    deployer: null,
    deploymentTxHash: null,
    uniswapRouter: null,
    uniswapQuoter: null,
    usdcAddress: null,
    wethAddress: null,
    poolFee: null,
    maxSlippageBps: null,
    deployedAt: null,
    verified: false,
    verifiedAt: null,
    explorerAddressUrl: null,
    explorerCodeUrl: null,
  };
}

export async function readDeploymentRecord(networkName: string): Promise<DeploymentRecord> {
  const filePath = deploymentPath(networkName);
  try {
    const content = await fs.readFile(filePath, "utf-8");
    return JSON.parse(content) as DeploymentRecord;
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === "ENOENT") {
      return createEmptyDeploymentRecord(networkName);
    }

    throw error;
  }
}

export async function writeDeploymentRecord(networkName: string, record: DeploymentRecord): Promise<void> {
  const filePath = deploymentPath(networkName);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(record, null, 2)}\n`, "utf-8");
}

function renderDeploymentBlockEn(record: DeploymentRecord): string {
  if (!record.address) {
    return [
      DEPLOYMENT_INFO_START,
      "## Deployment Info",
      "",
      "- Network: Sepolia",
      "- Contract: `DCAPlanManager`",
      "- Status: not deployed from this repository yet",
      DEPLOYMENT_INFO_END,
    ].join("\n");
  }

  return [
    DEPLOYMENT_INFO_START,
    "## Deployment Info",
    "",
    `- Network: ${record.network}`,
    `- Contract: \`${record.contract}\``,
    `- Address: \`${record.address}\``,
    `- Explorer: [address](${record.explorerAddressUrl})`,
    `- Code: [verified/source](${record.explorerCodeUrl})`,
    `- Deploy tx: \`${record.deploymentTxHash}\``,
    `- Deployer: \`${record.deployer}\``,
    `- Deployed at: ${record.deployedAt}`,
    `- Verified: ${record.verified ? "yes" : "no"}`,
    `- Verified at: ${record.verifiedAt ?? "not verified yet"}`,
    DEPLOYMENT_INFO_END,
  ].join("\n");
}

function replaceDeploymentBlock(content: string, replacement: string): string {
  const startIndex = content.indexOf(DEPLOYMENT_INFO_START);
  const endIndex = content.indexOf(DEPLOYMENT_INFO_END);
  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    throw new Error("Deployment info markers are missing in README.");
  }

  return `${content.slice(0, startIndex)}${replacement}${content.slice(endIndex + DEPLOYMENT_INFO_END.length)}`;
}

export async function updateDeploymentDocs(record: DeploymentRecord): Promise<void> {
  const docs = [
    {
      filePath: path.join(process.cwd(), "README.md"),
      renderer: renderDeploymentBlockEn,
    },
  ];

  await Promise.all(docs.map(async ({ filePath, renderer }) => {
    const content = await fs.readFile(filePath, "utf-8");
    const updated = replaceDeploymentBlock(content, renderer(record));
    await fs.writeFile(filePath, updated, "utf-8");
  }));
}

export function applyDeploymentMetadata(
  networkName: string,
  record: DeploymentRecord,
  updates: Partial<DeploymentRecord>,
): DeploymentRecord {
  const next = {
    ...record,
    ...updates,
  };

  if (next.address) {
    next.explorerAddressUrl = explorerAddressUrl(networkName, next.address);
    next.explorerCodeUrl = explorerCodeUrl(networkName, next.address);
  } else {
    next.explorerAddressUrl = null;
    next.explorerCodeUrl = null;
  }

  return next;
}
