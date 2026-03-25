import hre from "hardhat";
import { applyDeploymentMetadata, readDeploymentRecord, updateDeploymentDocs, writeDeploymentRecord } from "./lib/deploymentRegistry";

function isAlreadyVerified(message: string): boolean {
  const normalized = message.toLowerCase();
  return normalized.includes("already verified") || normalized.includes("source code already verified");
}

async function main(): Promise<void> {
  const networkName = hre.network.name;
  const record = await readDeploymentRecord(networkName);

  if (!record.address) {
    throw new Error(`No deployed contract address found in deployments/${networkName}.json`);
  }
  if (!record.uniswapRouter || record.poolFee === null || record.maxSlippageBps === null) {
    throw new Error(`Missing constructor arguments in deployments/${networkName}.json`);
  }

  let verified = false;
  try {
    await hre.run("verify:verify", {
      address: record.address,
      constructorArguments: [
        record.uniswapRouter,
        record.poolFee,
        record.maxSlippageBps,
      ],
      contract: "contracts/DCAPlanManager.sol:DCAPlanManager",
    });
    verified = true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!isAlreadyVerified(message)) {
      throw error;
    }
    verified = true;
    console.log("Contract is already verified on Etherscan.");
  }

  if (verified) {
    const updated = applyDeploymentMetadata(networkName, record, {
      verified: true,
      verifiedAt: new Date().toISOString(),
    });
    await writeDeploymentRecord(networkName, updated);
    await updateDeploymentDocs(updated);
    console.log(`Verification state recorded in deployments/${networkName}.json`);
  }
}

void main();
