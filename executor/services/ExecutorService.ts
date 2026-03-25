import { Contract, JsonRpcProvider, Wallet } from "ethers";
import { RuntimeConfig } from "../../src/common/env";
import { describeError } from "../../src/common/errors";
import { getDcaManagerContract } from "../../src/common/ethereum";
import { calculateMinAmountOut } from "../../src/common/math";
import { getPlanStatus, normalizePlan } from "../../src/common/plan";
import { StateRepository } from "../../src/storage/sqlite";
import { QuoteService } from "./QuoteService";

export class ExecutorService {
  private readonly config: RuntimeConfig;
  private readonly repository: StateRepository;
  private readonly manager: Contract;
  private readonly wallet: Wallet;
  private readonly quoteService: QuoteService;

  constructor(config: RuntimeConfig, repository: StateRepository, provider: JsonRpcProvider, wallet: Wallet) {
    this.config = config;
    this.repository = repository;
    this.wallet = wallet;
    this.manager = getDcaManagerContract(config.dcaManagerAddress, wallet);
    this.quoteService = new QuoteService(config.uniswapQuoter, provider);
  }

  async runOnce(): Promise<void> {
    const totalPlans = Number(await this.manager.nextPlanId() as bigint);
    this.log("info", `Executor scan started for ${totalPlans} plans`);

    for (let planId = 0; planId < totalPlans; planId += 1) {
      await this.processPlan(planId);
    }

    this.log("info", "Executor scan completed");
  }

  private async processPlan(planId: number): Promise<void> {
    try {
      const rawPlan = await this.manager.getPlan(planId) as Record<string, unknown>;
      const plan = normalizePlan(rawPlan);
      this.repository.upsertPlanSnapshot(planId, plan, getPlanStatus(plan));

      const executable = await this.manager.canExecute(planId) as boolean;
      if (!executable) {
        return;
      }

      const quoteAmountOut = await this.quoteService.quoteExactInputSingle({
        tokenIn: plan.tokenIn,
        tokenOut: plan.tokenOut,
        amountIn: plan.amountPerInterval,
        fee: this.config.poolFee,
      });

      const minAmountOut = calculateMinAmountOut(quoteAmountOut, plan.slippageBps);
      const deadline = BigInt(Math.floor(Date.now() / 1000) + this.config.executorDeadlineSeconds);

      const transaction = await this.manager.executePlan(planId, minAmountOut, deadline);
      const receipt = await transaction.wait();

      this.repository.recordExecutionAttempt({
        planId,
        quotedAmountOut: quoteAmountOut.toString(),
        minAmountOut: minAmountOut.toString(),
        deadline: deadline.toString(),
        txHash: receipt?.hash ?? transaction.hash,
        success: true,
        error: null,
      });

      const updatedRawPlan = await this.manager.getPlan(planId) as Record<string, unknown>;
      const updatedPlan = normalizePlan(updatedRawPlan);
      this.repository.upsertPlanSnapshot(planId, updatedPlan, getPlanStatus(updatedPlan));

      this.log("info", `Plan ${planId} executed`, {
        planId,
        txHash: receipt?.hash ?? transaction.hash,
        minAmountOut: minAmountOut.toString(),
      });
    } catch (error) {
      const message = describeError(error);
      this.repository.recordExecutionAttempt({
        planId,
        quotedAmountOut: "0",
        minAmountOut: "0",
        deadline: "0",
        txHash: null,
        success: false,
        error: message,
      });

      this.log("error", `Plan ${planId} execution failed`, {
        planId,
        error: message,
      });
    }
  }

  private log(level: "info" | "warn" | "error", message: string, context?: unknown): void {
    const serializedContext = context ? ` ${JSON.stringify(context)}` : "";
    console.log(`[executor:${level}] ${message}${serializedContext}`);
    this.repository.log(level, message, context);
  }
}
