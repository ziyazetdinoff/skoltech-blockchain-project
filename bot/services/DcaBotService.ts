import { JsonRpcProvider, Wallet, parseUnits } from "ethers";
import { getDemoPairConfig } from "../../config/tokens";
import { BotConfig } from "../../src/common/env";
import { describeError } from "../../src/common/errors";
import { createWallet, ensureAllowance, getDcaManagerContract } from "../../src/common/ethereum";
import { formatPlanDetails, formatPlanSummary, getPlanStatus, normalizePlan } from "../../src/common/plan";
import { TokenMetadataCache } from "../../src/common/tokenMetadata";
import { DcaPlan } from "../../src/common/types";
import { StateRepository } from "../../src/storage/sqlite";

export interface CreatePlanInput {
  amountPerInterval: string;
  totalBudget: string;
  intervalSeconds: number;
  slippageBps: number;
  recipient: string;
  startTime?: bigint;
}

export interface UpdatePlanInput {
  amountPerInterval: string;
  intervalSeconds: number;
  slippageBps: number;
}

export class DcaBotService {
  private readonly config: BotConfig;
  private readonly wallet: Wallet;
  private readonly manager: ReturnType<typeof getDcaManagerContract>;
  private readonly metadataCache: TokenMetadataCache;
  private readonly repository: StateRepository;

  constructor(config: BotConfig, provider: JsonRpcProvider, repository: StateRepository) {
    this.config = config;
    this.wallet = createWallet(config.backendPrivateKey, provider);
    this.manager = getDcaManagerContract(config.dcaManagerAddress, this.wallet);
    this.metadataCache = new TokenMetadataCache(provider);
    this.repository = repository;
  }

  getWalletAddress(): string {
    return this.wallet.address;
  }

  async listPlans(): Promise<string> {
    const pair = getDemoPairConfig(this.config);
    const [tokenIn, tokenOut] = await Promise.all([
      this.metadataCache.get(pair.tokenIn.address),
      this.metadataCache.get(pair.tokenOut.address),
    ]);
    const totalPlans = Number(await this.manager.nextPlanId() as bigint);
    const plans: string[] = [];

    for (let planId = 0; planId < totalPlans; planId += 1) {
      const plan = await this.fetchOwnedPlan(planId).catch(() => null);
      if (!plan) {
        continue;
      }

      plans.push(formatPlanSummary(planId, plan, tokenIn, tokenOut));
    }

    if (plans.length === 0) {
      return "Планов пока нет.";
    }

    return plans.join("\n\n");
  }

  async getPlanDetails(planId: number): Promise<string> {
    const pair = getDemoPairConfig(this.config);
    const [plan, tokenIn, tokenOut] = await Promise.all([
      this.fetchOwnedPlan(planId),
      this.metadataCache.get(pair.tokenIn.address),
      this.metadataCache.get(pair.tokenOut.address),
    ]);

    return formatPlanDetails(planId, plan, tokenIn, tokenOut);
  }

  async createPlan(input: CreatePlanInput): Promise<string> {
    const pair = getDemoPairConfig(this.config);
    const tokenIn = await this.metadataCache.get(pair.tokenIn.address);
    const amountPerInterval = parseUnits(input.amountPerInterval, tokenIn.decimals);
    const totalBudget = parseUnits(input.totalBudget, tokenIn.decimals);

    if (totalBudget < amountPerInterval) {
      throw new Error("Total budget must be greater than or equal to amount per interval.");
    }

    await ensureAllowance(pair.tokenIn.address, this.wallet, this.config.dcaManagerAddress, totalBudget);

    const currentPlanId = await this.manager.nextPlanId() as bigint;
    const transaction = await this.manager.createPlan(
      pair.tokenIn.address,
      pair.tokenOut.address,
      amountPerInterval,
      totalBudget,
      input.intervalSeconds,
      input.slippageBps,
      this.resolveRecipient(input.recipient),
      input.startTime ?? BigInt(Math.floor(Date.now() / 1000)),
    );
    const receipt = await transaction.wait();

    const createdPlanId = Number(currentPlanId);
    const plan = await this.fetchOwnedPlan(createdPlanId);
    this.repository.upsertPlanSnapshot(createdPlanId, plan, getPlanStatus(plan));
    this.repository.log("info", "Plan created from Telegram bot", {
      planId: createdPlanId,
      txHash: receipt?.hash ?? transaction.hash,
    });

    return `Plan #${createdPlanId} created.\nTx: ${receipt?.hash ?? transaction.hash}`;
  }

  async pausePlan(planId: number): Promise<string> {
    return this.runPlanMutation(planId, async () => {
      const tx = await this.manager.pausePlan(planId);
      const receipt = await tx.wait();
      return `Plan #${planId} paused.\nTx: ${receipt?.hash ?? tx.hash}`;
    });
  }

  async resumePlan(planId: number): Promise<string> {
    return this.runPlanMutation(planId, async () => {
      const tx = await this.manager.resumePlan(planId);
      const receipt = await tx.wait();
      return `Plan #${planId} resumed.\nTx: ${receipt?.hash ?? tx.hash}`;
    });
  }

  async cancelPlan(planId: number): Promise<string> {
    return this.runPlanMutation(planId, async () => {
      const tx = await this.manager.cancelPlan(planId);
      const receipt = await tx.wait();
      return `Plan #${planId} canceled.\nTx: ${receipt?.hash ?? tx.hash}`;
    });
  }

  async topUpPlan(planId: number, amount: string): Promise<string> {
    const pair = getDemoPairConfig(this.config);
    const tokenIn = await this.metadataCache.get(pair.tokenIn.address);
    const parsedAmount = parseUnits(amount, tokenIn.decimals);

    await ensureAllowance(pair.tokenIn.address, this.wallet, this.config.dcaManagerAddress, parsedAmount);

    return this.runPlanMutation(planId, async () => {
      const tx = await this.manager.topUpPlan(planId, parsedAmount);
      const receipt = await tx.wait();
      return `Plan #${planId} topped up by ${amount} ${tokenIn.symbol}.\nTx: ${receipt?.hash ?? tx.hash}`;
    });
  }

  async withdrawUnusedFunds(planId: number, amount: string): Promise<string> {
    const pair = getDemoPairConfig(this.config);
    const tokenIn = await this.metadataCache.get(pair.tokenIn.address);
    const parsedAmount = parseUnits(amount, tokenIn.decimals);

    return this.runPlanMutation(planId, async () => {
      const tx = await this.manager.withdrawUnusedFunds(planId, parsedAmount);
      const receipt = await tx.wait();
      return `Withdrew ${amount} ${tokenIn.symbol} from plan #${planId}.\nTx: ${receipt?.hash ?? tx.hash}`;
    });
  }

  async updatePlan(planId: number, input: UpdatePlanInput): Promise<string> {
    const pair = getDemoPairConfig(this.config);
    const tokenIn = await this.metadataCache.get(pair.tokenIn.address);
    const amountPerInterval = parseUnits(input.amountPerInterval, tokenIn.decimals);

    return this.runPlanMutation(planId, async () => {
      const tx = await this.manager.updatePlan(
        planId,
        amountPerInterval,
        input.intervalSeconds,
        input.slippageBps,
      );
      const receipt = await tx.wait();
      return `Plan #${planId} updated.\nTx: ${receipt?.hash ?? tx.hash}`;
    });
  }

  formatError(error: unknown): string {
    return describeError(error);
  }

  private async runPlanMutation(planId: number, action: () => Promise<string>): Promise<string> {
    await this.fetchOwnedPlan(planId);
    const response = await action();
    const plan = await this.fetchOwnedPlan(planId);
    this.repository.upsertPlanSnapshot(planId, plan, getPlanStatus(plan));
    return response;
  }

  private async fetchOwnedPlan(planId: number): Promise<DcaPlan> {
    const rawPlan = await this.manager.getPlan(planId) as Record<string, unknown>;
    const plan = normalizePlan(rawPlan);
    if (plan.owner.toLowerCase() !== this.wallet.address.toLowerCase()) {
      throw new Error(`Plan ${planId} is not owned by configured backend wallet.`);
    }

    return plan;
  }

  private resolveRecipient(input: string): string {
    if (input.toLowerCase() === "me") {
      return this.wallet.address;
    }

    return input;
  }
}
