import fs from "node:fs/promises";
import path from "node:path";
import { ethers } from "hardhat";
import { getNetworkConfig } from "../config/networks";
import { loadDeployConfig } from "../src/common/env";

async function main(): Promise<void> {
  const config = loadDeployConfig();
  const network = getNetworkConfig(config.networkName);
  const factory = await ethers.getContractFactory("DCAPlanManager");
  const contract = await factory.deploy(config.uniswapRouter, config.poolFee, config.maxSlippageBps);

  await contract.waitForDeployment();

  const contractAddress = await contract.getAddress();
  const deploymentRecord = {
    network: network.key,
    chainId: network.chainId,
    contract: "DCAPlanManager",
    address: contractAddress,
    uniswapRouter: config.uniswapRouter,
    uniswapQuoter: config.uniswapQuoter,
    usdcAddress: config.usdcAddress,
    wethAddress: config.wethAddress,
    poolFee: config.poolFee,
    maxSlippageBps: config.maxSlippageBps,
    deployedAt: new Date().toISOString(),
  };

  const outputPath = path.join(process.cwd(), "deployments", `${config.networkName}.json`);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(deploymentRecord, null, 2)}\n`, "utf-8");

  console.log(`DCAPlanManager deployed to ${contractAddress}`);
  console.log(`Deployment metadata written to ${outputPath}`);
}

void main();
