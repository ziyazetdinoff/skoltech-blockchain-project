import { readDeploymentRecord, updateDeploymentDocs } from "./lib/deploymentRegistry";

async function main(): Promise<void> {
  const networkName = process.env.NETWORK_NAME ?? "sepolia";
  const record = await readDeploymentRecord(networkName);
  await updateDeploymentDocs(record);
  console.log(`Deployment docs updated from deployments/${networkName}.json`);
}

void main();
