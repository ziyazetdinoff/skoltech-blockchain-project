import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { expect } from "chai";
import { calculateMinAmountOut } from "../src/common/math";
import { getPlanStatus, normalizePlan } from "../src/common/plan";
import { StateRepository } from "../src/storage/sqlite";

describe("backend helpers", () => {
  it("calculates minAmountOut with slippage in bps", () => {
    expect(calculateMinAmountOut(1_000_000n, 300n)).to.equal(970_000n);
    expect(calculateMinAmountOut(1_000_000n, 0n)).to.equal(1_000_000n);
  });

  it("normalizes plan payloads and derives completed status", () => {
    const plan = normalizePlan({
      owner: "0x0000000000000000000000000000000000000001",
      recipient: "0x0000000000000000000000000000000000000002",
      tokenIn: "0x0000000000000000000000000000000000000003",
      tokenOut: "0x0000000000000000000000000000000000000004",
      amountPerInterval: 100n,
      totalBudget: 300n,
      remainingBudget: 50n,
      intervalSeconds: 3600n,
      slippageBps: 300n,
      startTime: 1n,
      nextExecutionTime: 2n,
      active: true,
      paused: false,
      canceled: false,
    });

    expect(getPlanStatus(plan)).to.equal("Completed");
  });

  it("stores plan snapshots and execution attempts in SQLite", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "dca-sqlite-"));
    const databasePath = path.join(directory, "state.sqlite");
    const repository = new StateRepository(databasePath);

    repository.upsertPlanSnapshot(7, {
      owner: "0xowner",
      recipient: "0xrecipient",
      tokenIn: "0xtokenin",
      tokenOut: "0xtokenout",
      amountPerInterval: 100n,
      totalBudget: 500n,
      remainingBudget: 400n,
      intervalSeconds: 60n,
      slippageBps: 300n,
      startTime: 1n,
      nextExecutionTime: 2n,
      active: true,
      paused: false,
      canceled: false,
    }, "Active");

    repository.recordExecutionAttempt({
      planId: 7,
      quotedAmountOut: "123",
      minAmountOut: "120",
      deadline: "999",
      txHash: "0xhash",
      success: true,
      error: null,
    });

    const snapshot = repository.getPlanSnapshot(7);
    const attempts = repository.listExecutionAttempts(5);
    repository.close();

    expect(snapshot).to.not.equal(null);
    expect(snapshot?.planId).to.equal(7);
    expect(snapshot?.status).to.equal("Active");
    expect(attempts).to.have.lengthOf(1);
    expect(attempts[0].txHash).to.equal("0xhash");
    expect(attempts[0].success).to.equal(true);
  });
});
