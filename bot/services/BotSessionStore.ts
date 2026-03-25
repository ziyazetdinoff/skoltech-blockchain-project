export interface CreatePlanDraft {
  amountPerInterval?: string;
  totalBudget?: string;
  intervalSeconds?: number;
  slippageBps?: number;
  recipient?: string;
  startTime?: bigint;
}

export interface UpdatePlanDraft {
  amountPerInterval?: string;
  intervalSeconds?: number;
  slippageBps?: number;
}

export type BotSession =
  | {
      kind: "create";
      step: "amountPerInterval" | "totalBudget" | "intervalSeconds" | "slippageBps" | "recipient" | "startTime";
      draft: CreatePlanDraft;
    }
  | {
      kind: "update";
      planId: number;
      step: "amountPerInterval" | "intervalSeconds" | "slippageBps";
      draft: UpdatePlanDraft;
    };

export class BotSessionStore {
  private readonly sessions = new Map<number, BotSession>();

  get(userId: number): BotSession | undefined {
    return this.sessions.get(userId);
  }

  set(userId: number, session: BotSession): void {
    this.sessions.set(userId, session);
  }

  clear(userId: number): void {
    this.sessions.delete(userId);
  }
}
