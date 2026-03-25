import { ethers, network } from "hardhat";
import { loadDeployConfig } from "../src/common/env";
import { applyDeploymentMetadata, createEmptyDeploymentRecord, updateDeploymentDocs, writeDeploymentRecord } from "./lib/deploymentRegistry";

async function main(): Promise<void> {
  const config = loadDeployConfig();
  const networkName = network.name;
  const factory = await ethers.getContractFactory("DCAPlanManager");
  const [deployerSigner] = await ethers.getSigners();
  const contract = await factory.deploy(config.uniswapRouter, config.poolFee, config.maxSlippageBps);

  await contract.waitForDeployment();

  const contractAddress = await contract.getAddress();
  const deploymentTxHash = contract.deploymentTransaction()?.hash ?? null;
  const deploymentRecord = applyDeploymentMetadata(
    networkName,
    createEmptyDeploymentRecord(networkName),
    {
      address: contractAddress,
      deployer: await deployerSigner.getAddress(),
      deploymentTxHash,
      uniswapRouter: config.uniswapRouter,
      uniswapQuoter: config.uniswapQuoter,
      usdcAddress: config.usdcAddress,
      wethAddress: config.wethAddress,
      poolFee: config.poolFee,
      maxSlippageBps: config.maxSlippageBps,
      deployedAt: new Date().toISOString(),
      verified: false,
      verifiedAt: null,
    },
  );

  await writeDeploymentRecord(networkName, deploymentRecord);
  await updateDeploymentDocs(deploymentRecord);

  console.log(`DCAPlanManager deployed to ${contractAddress}`);
  console.log(`Deployment metadata written to deployments/${networkName}.json`);
  console.log("README.md and README_ENG.md were updated with the current deployment info.");
}

void main();
