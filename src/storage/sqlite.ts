import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { DcaPlan, ExecutionAttemptRecord, PlanSnapshotRecord, PlanStatus } from "../common/types";

function toIsoNow(): string {
  return new Date().toISOString();
}

function boolToInt(value: boolean): number {
  return value ? 1 : 0;
}

export class StateRepository {
  private readonly database: DatabaseSync;

  constructor(databasePath: string) {
    fs.mkdirSync(path.dirname(databasePath), { recursive: true });
    this.database = new DatabaseSync(databasePath);
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS plan_snapshots (
        plan_id INTEGER PRIMARY KEY,
        owner TEXT NOT NULL,
        recipient TEXT NOT NULL,
        token_in TEXT NOT NULL,
        token_out TEXT NOT NULL,
        amount_per_interval TEXT NOT NULL,
        total_budget TEXT NOT NULL,
        remaining_budget TEXT NOT NULL,
        interval_seconds TEXT NOT NULL,
        slippage_bps INTEGER NOT NULL,
        start_time TEXT NOT NULL,
        next_execution_time TEXT NOT NULL,
        active INTEGER NOT NULL,
        paused INTEGER NOT NULL,
        canceled INTEGER NOT NULL,
        status TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS execution_attempts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        plan_id INTEGER NOT NULL,
        quoted_amount_out TEXT NOT NULL,
        min_amount_out TEXT NOT NULL,
        deadline TEXT NOT NULL,
        tx_hash TEXT,
        success INTEGER NOT NULL,
        error TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS service_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        level TEXT NOT NULL,
        message TEXT NOT NULL,
        context TEXT,
        created_at TEXT NOT NULL
      );
    `);
  }

  upsertPlanSnapshot(planId: number, plan: DcaPlan, status: PlanStatus): void {
    const statement = this.database.prepare(`
      INSERT INTO plan_snapshots (
        plan_id, owner, recipient, token_in, token_out, amount_per_interval, total_budget,
        remaining_budget, interval_seconds, slippage_bps, start_time, next_execution_time,
        active, paused, canceled, status, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
      ON CONFLICT(plan_id) DO UPDATE SET
        owner = excluded.owner,
        recipient = excluded.recipient,
        token_in = excluded.token_in,
        token_out = excluded.token_out,
        amount_per_interval = excluded.amount_per_interval,
        total_budget = excluded.total_budget,
        remaining_budget = excluded.remaining_budget,
        interval_seconds = excluded.interval_seconds,
        slippage_bps = excluded.slippage_bps,
        start_time = excluded.start_time,
        next_execution_time = excluded.next_execution_time,
        active = excluded.active,
        paused = excluded.paused,
        canceled = excluded.canceled,
        status = excluded.status,
        updated_at = excluded.updated_at
    `);

    statement.run(
      planId,
      plan.owner,
      plan.recipient,
      plan.tokenIn,
      plan.tokenOut,
      plan.amountPerInterval.toString(),
      plan.totalBudget.toString(),
      plan.remainingBudget.toString(),
      plan.intervalSeconds.toString(),
      Number(plan.slippageBps),
      plan.startTime.toString(),
      plan.nextExecutionTime.toString(),
      boolToInt(plan.active),
      boolToInt(plan.paused),
      boolToInt(plan.canceled),
      status,
      toIsoNow(),
    );
  }

  recordExecutionAttempt(record: Omit<ExecutionAttemptRecord, "createdAt">): void {
    const statement = this.database.prepare(`
      INSERT INTO execution_attempts (
        plan_id, quoted_amount_out, min_amount_out, deadline, tx_hash, success, error, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    statement.run(
      record.planId,
      record.quotedAmountOut,
      record.minAmountOut,
      record.deadline,
      record.txHash,
      boolToInt(record.success),
      record.error,
      toIsoNow(),
    );
  }

  log(level: "info" | "error" | "warn", message: string, context?: unknown): void {
    const statement = this.database.prepare(`
      INSERT INTO service_logs (level, message, context, created_at) VALUES (?, ?, ?, ?)
    `);

    statement.run(level, message, context ? JSON.stringify(context) : null, toIsoNow());
  }

  getPlanSnapshot(planId: number): PlanSnapshotRecord | null {
    const statement = this.database.prepare(`
      SELECT
        plan_id as planId,
        owner,
        recipient,
        token_in as tokenIn,
        token_out as tokenOut,
        amount_per_interval as amountPerInterval,
        total_budget as totalBudget,
        remaining_budget as remainingBudget,
        interval_seconds as intervalSeconds,
        slippage_bps as slippageBps,
        start_time as startTime,
        next_execution_time as nextExecutionTime,
        active,
        paused,
        canceled,
        status,
        updated_at as updatedAt
      FROM plan_snapshots
      WHERE plan_id = ?
    `);

    const row = statement.get(planId) as ({
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
      active: number;
      paused: number;
      canceled: number;
      status: PlanStatus;
      updatedAt: string;
    }) | undefined;
    if (!row) {
      return null;
    }

    return {
      planId: row.planId,
      owner: row.owner,
      recipient: row.recipient,
      tokenIn: row.tokenIn,
      tokenOut: row.tokenOut,
      amountPerInterval: row.amountPerInterval,
      totalBudget: row.totalBudget,
      remainingBudget: row.remainingBudget,
      intervalSeconds: row.intervalSeconds,
      slippageBps: row.slippageBps,
      startTime: row.startTime,
      nextExecutionTime: row.nextExecutionTime,
      active: Boolean(row.active),
      paused: Boolean(row.paused),
      canceled: Boolean(row.canceled),
      status: row.status,
      updatedAt: row.updatedAt,
    };
  }

  listExecutionAttempts(limit = 20): ExecutionAttemptRecord[] {
    const statement = this.database.prepare(`
      SELECT
        plan_id as planId,
        quoted_amount_out as quotedAmountOut,
        min_amount_out as minAmountOut,
        deadline,
        tx_hash as txHash,
        success,
        error,
        created_at as createdAt
      FROM execution_attempts
      ORDER BY id DESC
      LIMIT ?
    `);

    const rows = statement.all(limit) as Array<{
      planId: number;
      quotedAmountOut: string;
      minAmountOut: string;
      deadline: string;
      txHash: string | null;
      success: number;
      error: string | null;
      createdAt: string;
    }>;
    return rows.map((row) => ({
      planId: row.planId,
      quotedAmountOut: row.quotedAmountOut,
      minAmountOut: row.minAmountOut,
      deadline: row.deadline,
      txHash: row.txHash,
      success: Boolean(row.success),
      error: row.error,
      createdAt: row.createdAt,
    }));
  }

  close(): void {
    this.database.close();
  }
}
