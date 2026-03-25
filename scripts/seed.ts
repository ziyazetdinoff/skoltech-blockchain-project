import { parseUnits } from "ethers";
import { getDemoPairConfig } from "../config/tokens";
import { loadRuntimeConfig } from "../src/common/env";
import { createProvider, createWallet, ensureAllowance, getDcaManagerContract, getTokenMetadata } from "../src/common/ethereum";

function usage(): string {
  return [
    "Usage:",
    "npm run seed:sepolia -- <amountPerInterval> <totalBudget> <intervalSeconds> <slippageBps> [recipient] [startTime]",
    "",
    "Example:",
    "npm run seed:sepolia -- 10 100 604800 300 me now",
  ].join("\n");
}

function parseStartTime(input: string | undefined): bigint {
  if (!input || input.toLowerCase() === "now") {
    return BigInt(Math.floor(Date.now() / 1000));
  }
  if (/^\d+$/.test(input)) {
    return BigInt(input);
  }

  const parsed = Date.parse(input);
  if (Number.isNaN(parsed)) {
    throw new Error("startTime must be `now`, unix timestamp or ISO datetime");
  }

  return BigInt(Math.floor(parsed / 1000));
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length < 4) {
    throw new Error(usage());
  }

  const [amountPerIntervalInput, totalBudgetInput, intervalSecondsInput, slippageInput, recipientInput, startTimeInput] = args;
  const intervalSeconds = Number(intervalSecondsInput);
  const slippageBps = Number(slippageInput);
  if (!Number.isInteger(intervalSeconds) || intervalSeconds <= 0) {
    throw new Error("intervalSeconds must be a positive integer");
  }
  if (!Number.isInteger(slippageBps) || slippageBps <= 0) {
    throw new Error("slippageBps must be a positive integer");
  }

  const config = loadRuntimeConfig();
  const provider = createProvider(config.rpcUrl);
  const wallet = createWallet(config.backendPrivateKey, provider);
  const pair = getDemoPairConfig(config);
  const manager = getDcaManagerContract(config.dcaManagerAddress, wallet);
  const tokenInMetadata = await getTokenMetadata(pair.tokenIn.address, provider);
  const amountPerInterval = parseUnits(amountPerIntervalInput, tokenInMetadata.decimals);
  const totalBudget = parseUnits(totalBudgetInput, tokenInMetadata.decimals);
  const recipient = !recipientInput || recipientInput.toLowerCase() === "me" ? wallet.address : recipientInput;
  const startTime = parseStartTime(startTimeInput);

  await ensureAllowance(pair.tokenIn.address, wallet, config.dcaManagerAddress, totalBudget);

  const currentPlanId = await manager.nextPlanId() as bigint;
  const tx = await manager.createPlan(
    pair.tokenIn.address,
    pair.tokenOut.address,
    amountPerInterval,
    totalBudget,
    intervalSeconds,
    slippageBps,
    recipient,
    startTime,
  );
  const receipt = await tx.wait();

  console.log(`Created demo plan #${currentPlanId.toString()}`);
  console.log(`Tx hash: ${receipt?.hash ?? tx.hash}`);
}

void main();
