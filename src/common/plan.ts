import { formatUnits } from "ethers";
import { DcaPlan, PlanStatus, TokenMetadata } from "./types";

type RawPlan = Record<string, unknown>;

function asBigInt(value: unknown): bigint {
  if (typeof value === "bigint") {
    return value;
  }
  if (typeof value === "number") {
    return BigInt(value);
  }
  if (typeof value === "string") {
    return BigInt(value);
  }

  throw new Error(`Cannot convert value to bigint: ${String(value)}`);
}

function asBoolean(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  throw new Error(`Cannot convert value to boolean: ${String(value)}`);
}

function asAddress(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error(`Cannot convert value to address: ${String(value)}`);
  }

  return value;
}

export function normalizePlan(rawPlan: RawPlan): DcaPlan {
  return {
    owner: asAddress(rawPlan.owner),
    recipient: asAddress(rawPlan.recipient),
    tokenIn: asAddress(rawPlan.tokenIn),
    tokenOut: asAddress(rawPlan.tokenOut),
    amountPerInterval: asBigInt(rawPlan.amountPerInterval),
    totalBudget: asBigInt(rawPlan.totalBudget),
    remainingBudget: asBigInt(rawPlan.remainingBudget),
    intervalSeconds: asBigInt(rawPlan.intervalSeconds),
    slippageBps: asBigInt(rawPlan.slippageBps),
    startTime: asBigInt(rawPlan.startTime),
    nextExecutionTime: asBigInt(rawPlan.nextExecutionTime),
    active: asBoolean(rawPlan.active),
    paused: asBoolean(rawPlan.paused),
    canceled: asBoolean(rawPlan.canceled),
  };
}

export function getPlanStatus(plan: DcaPlan): PlanStatus {
  if (plan.canceled) {
    return "Canceled";
  }
  if (plan.paused) {
    return "Paused";
  }
  if (plan.remainingBudget < plan.amountPerInterval) {
    return "Completed";
  }

  return "Active";
}

export function formatUnixTimestamp(value: bigint): string {
  return new Date(Number(value) * 1000).toISOString();
}

function formatAmount(amount: bigint, token: TokenMetadata): string {
  return `${formatUnits(amount, token.decimals)} ${token.symbol}`;
}

export function formatPlanSummary(
  planId: number,
  plan: DcaPlan,
  tokenIn: TokenMetadata,
  tokenOut: TokenMetadata,
): string {
  return [
    `#${planId} [${getPlanStatus(plan)}]`,
    `${formatAmount(plan.amountPerInterval, tokenIn)} -> ${tokenOut.symbol}`,
    `remaining: ${formatAmount(plan.remainingBudget, tokenIn)}`,
    `next: ${formatUnixTimestamp(plan.nextExecutionTime)}`,
  ].join("\n");
}

export function formatPlanDetails(
  planId: number,
  plan: DcaPlan,
  tokenIn: TokenMetadata,
  tokenOut: TokenMetadata,
): string {
  return [
    `Plan #${planId}`,
    `status: ${getPlanStatus(plan)}`,
    `owner: ${plan.owner}`,
    `recipient: ${plan.recipient}`,
    `pair: ${tokenIn.symbol} -> ${tokenOut.symbol}`,
    `amount per interval: ${formatAmount(plan.amountPerInterval, tokenIn)}`,
    `total budget: ${formatAmount(plan.totalBudget, tokenIn)}`,
    `remaining budget: ${formatAmount(plan.remainingBudget, tokenIn)}`,
    `interval seconds: ${plan.intervalSeconds.toString()}`,
    `slippage bps: ${plan.slippageBps.toString()}`,
    `start time: ${formatUnixTimestamp(plan.startTime)}`,
    `next execution: ${formatUnixTimestamp(plan.nextExecutionTime)}`,
  ].join("\n");
}
