export interface DcaPlan {
  owner: string;
  recipient: string;
  tokenIn: string;
  tokenOut: string;
  amountPerInterval: bigint;
  totalBudget: bigint;
  remainingBudget: bigint;
  intervalSeconds: bigint;
  slippageBps: bigint;
  startTime: bigint;
  nextExecutionTime: bigint;
  active: boolean;
  paused: boolean;
  canceled: boolean;
}

export type PlanStatus = "Active" | "Paused" | "Canceled" | "Completed";

export interface TokenMetadata {
  address: string;
  symbol: string;
  decimals: number;
}

export interface PlanSnapshotRecord {
  planId: number;
  owner: string;
  recipient: string;
  tokenIn: string;
  tokenOut: string;
  amountPerInterval: string;
  totalBudget: string;
  remainingBudget: string;
  intervalSeconds: string;
  slippageBps: number;
  startTime: string;
  nextExecutionTime: string;
  active: boolean;
  paused: boolean;
  canceled: boolean;
  status: PlanStatus;
  updatedAt: string;
}

export interface ExecutionAttemptRecord {
  planId: number;
  quotedAmountOut: string;
  minAmountOut: string;
  deadline: string;
  txHash: string | null;
  success: boolean;
  error: string | null;
  createdAt: string;
}
