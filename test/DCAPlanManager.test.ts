import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { MaxUint256, parseUnits } from "ethers";

describe("DCAPlanManager", () => {
  async function deployFixture() {
    const [owner, user, stranger, executor, recipient] = await ethers.getSigners();

    const usdc = await ethers.deployContract("MockERC20", ["USD Coin", "USDC", 6]) as any;
    const weth = await ethers.deployContract("MockERC20", ["Wrapped Ether", "WETH", 18]) as any;
    const router = await ethers.deployContract("MockSwapRouter") as any;
    const manager = await ethers.deployContract("DCAPlanManager", [await router.getAddress(), 500, 1000]) as any;

    const userUsdcBalance = parseUnits("1000", 6);
    const routerWethBalance = parseUnits("100", 18);

    await usdc.mint(user.address, userUsdcBalance);
    await weth.mint(await router.getAddress(), routerWethBalance);
    await usdc.connect(user).approve(await manager.getAddress(), MaxUint256);

    return {
      owner,
      user,
      stranger,
      executor,
      recipient,
      usdc,
      weth,
      router,
      manager,
    };
  }

  async function createDefaultPlan() {
    const fixture = await loadFixture(deployFixture);
    const { user, recipient, usdc, weth, manager } = fixture;
    const startTime = await time.latest();

    await manager.connect(user).createPlan(
      await usdc.getAddress(),
      await weth.getAddress(),
      parseUnits("100", 6),
      parseUnits("300", 6),
      3600,
      300,
      recipient.address,
      startTime,
    );

    return fixture;
  }

  it("creates a plan and transfers budget into the contract", async () => {
    const { user, recipient, usdc, weth, manager } = await loadFixture(deployFixture);
    const startTime = await time.latest();
    const totalBudget = parseUnits("300", 6);

    await expect(
      manager.connect(user).createPlan(
        await usdc.getAddress(),
        await weth.getAddress(),
        parseUnits("100", 6),
        totalBudget,
        3600,
        300,
        recipient.address,
        startTime,
      ),
    )
      .to.emit(manager, "PlanCreated")
      .withArgs(0, user.address);

    const plan = await manager.getPlan(0);
    expect(plan.owner).to.equal(user.address);
    expect(plan.recipient).to.equal(recipient.address);
    expect(plan.remainingBudget).to.equal(totalBudget);
    expect(await usdc.balanceOf(await manager.getAddress())).to.equal(totalBudget);
  });

  it("rejects invalid create parameters", async () => {
    const { user, recipient, usdc, weth, manager } = await loadFixture(deployFixture);
    const startTime = await time.latest();

    await expect(
      manager.connect(user).createPlan(
        await usdc.getAddress(),
        await weth.getAddress(),
        parseUnits("200", 6),
        parseUnits("100", 6),
        3600,
        300,
        recipient.address,
        startTime,
      ),
    )
      .to.be.revertedWithCustomError(manager, "InvalidBudget")
      .withArgs(parseUnits("100", 6), parseUnits("200", 6));

    await expect(
      manager.connect(user).createPlan(
        await usdc.getAddress(),
        await weth.getAddress(),
        parseUnits("100", 6),
        parseUnits("200", 6),
        3600,
        5000,
        recipient.address,
        startTime,
      ),
    )
      .to.be.revertedWithCustomError(manager, "InvalidSlippage")
      .withArgs(5000, 1000);
  });

  it("allows only the owner to pause and resume a plan", async () => {
    const { user, stranger, manager } = await createDefaultPlan();

    await expect(manager.connect(stranger).pausePlan(0))
      .to.be.revertedWithCustomError(manager, "NotPlanOwner")
      .withArgs(0, stranger.address);

    await expect(manager.connect(user).pausePlan(0))
      .to.emit(manager, "PlanPaused")
      .withArgs(0);
    expect((await manager.getPlan(0)).paused).to.equal(true);

    await expect(manager.connect(user).resumePlan(0))
      .to.emit(manager, "PlanResumed")
      .withArgs(0);
    expect((await manager.getPlan(0)).paused).to.equal(false);
  });

  it("cancels a plan and allows withdrawing unused funds only afterwards", async () => {
    const { user, usdc, manager } = await createDefaultPlan();
    const withdrawAmount = parseUnits("120", 6);

    await expect(manager.connect(user).withdrawUnusedFunds(0, withdrawAmount))
      .to.be.revertedWithCustomError(manager, "WithdrawOnlyAfterCancel")
      .withArgs(0);

    await expect(manager.connect(user).cancelPlan(0))
      .to.emit(manager, "PlanCanceled")
      .withArgs(0);

    const balanceBefore = await usdc.balanceOf(user.address);
    await expect(manager.connect(user).withdrawUnusedFunds(0, withdrawAmount))
      .to.emit(manager, "UnusedFundsWithdrawn")
      .withArgs(0, withdrawAmount);
    const balanceAfter = await usdc.balanceOf(user.address);

    expect(balanceAfter - balanceBefore).to.equal(withdrawAmount);
    expect((await manager.getPlan(0)).remainingBudget).to.equal(parseUnits("180", 6));
  });

  it("supports top up and update operations", async () => {
    const { user, manager } = await createDefaultPlan();
    const topUpAmount = parseUnits("50", 6);

    await expect(manager.connect(user).topUpPlan(0, topUpAmount))
      .to.emit(manager, "PlanToppedUp")
      .withArgs(0, topUpAmount);

    await expect(manager.connect(user).updatePlan(0, parseUnits("80", 6), 7200, 250))
      .to.emit(manager, "PlanUpdated")
      .withArgs(0, parseUnits("80", 6), 7200, 250);

    const plan = await manager.getPlan(0);
    expect(plan.totalBudget).to.equal(parseUnits("350", 6));
    expect(plan.remainingBudget).to.equal(parseUnits("350", 6));
    expect(plan.amountPerInterval).to.equal(parseUnits("80", 6));
    expect(plan.intervalSeconds).to.equal(7200);
    expect(plan.slippageBps).to.equal(250);
  });

  it("executes a due plan and transfers tokenOut to the recipient", async () => {
    const { executor, recipient, weth, router, manager } = await createDefaultPlan();
    const amountOut = parseUnits("0.05", 18);

    await router.setQuoteAmountOut(amountOut);

    const tx = await manager.connect(executor).executePlan(0, amountOut, (await time.latest()) + 120);
    const receipt = await tx.wait();
    const block = await ethers.provider.getBlock(receipt!.blockNumber!);
    const plan = await manager.getPlan(0);

    expect(await weth.balanceOf(recipient.address)).to.equal(amountOut);
    expect(plan.remainingBudget).to.equal(parseUnits("200", 6));
    expect(plan.nextExecutionTime).to.equal(BigInt(block!.timestamp + 3600));
  });

  it("cannot execute a plan before the next execution time", async () => {
    const { user, recipient, usdc, weth, manager } = await loadFixture(deployFixture);
    const futureStart = (await time.latest()) + 3600;

    await manager.connect(user).createPlan(
      await usdc.getAddress(),
      await weth.getAddress(),
      parseUnits("100", 6),
      parseUnits("300", 6),
      3600,
      300,
      recipient.address,
      futureStart,
    );

    expect(await manager.canExecute(0)).to.equal(false);
    await expect(manager.executePlan(0, 0, futureStart + 120))
      .to.be.revertedWithCustomError(manager, "PlanNotExecutable")
      .withArgs(0);
  });

  it("becomes non-executable when remaining budget is below amount per interval", async () => {
    const { user, recipient, usdc, weth, router, manager } = await loadFixture(deployFixture);
    const now = await time.latest();
    const amountOut = parseUnits("0.05", 18);

    await manager.connect(user).createPlan(
      await usdc.getAddress(),
      await weth.getAddress(),
      parseUnits("100", 6),
      parseUnits("100", 6),
      3600,
      300,
      recipient.address,
      now,
    );

    await router.setQuoteAmountOut(amountOut);
    await manager.executePlan(0, amountOut, now + 120);

    expect(await manager.canExecute(0)).to.equal(false);
    expect(await manager.getPlanStatus(0)).to.equal("Completed");
  });

  it("skips missed intervals and schedules the next execution from the current block timestamp", async () => {
    const { executor, router, manager } = await createDefaultPlan();
    const amountOut = parseUnits("0.05", 18);

    await time.increase(3600 * 3);
    await router.setQuoteAmountOut(amountOut);

    const tx = await manager.connect(executor).executePlan(0, amountOut, (await time.latest()) + 120);
    const receipt = await tx.wait();
    const block = await ethers.provider.getBlock(receipt!.blockNumber!);
    const plan = await manager.getPlan(0);

    expect(plan.nextExecutionTime).to.equal(BigInt(block!.timestamp + 3600));
  });

  it("preserves plan state when swap execution reverts", async () => {
    const { executor, recipient, weth, router, manager } = await createDefaultPlan();

    await router.setQuoteAmountOut(parseUnits("0.05", 18));
    await router.setShouldRevert(true);

    const before = await manager.getPlan(0);
    await expect(manager.connect(executor).executePlan(0, 1, (await time.latest()) + 120))
      .to.be.revertedWithCustomError(router, "MockSwapReverted");
    const after = await manager.getPlan(0);

    expect(after.remainingBudget).to.equal(before.remainingBudget);
    expect(after.nextExecutionTime).to.equal(before.nextExecutionTime);
    expect(await weth.balanceOf(recipient.address)).to.equal(0);
  });

  it("disables execution while the contract is globally paused", async () => {
    const { owner, manager } = await createDefaultPlan();

    await manager.connect(owner).pause();

    expect(await manager.canExecute(0)).to.equal(false);
    await expect(manager.executePlan(0, 0, (await time.latest()) + 120)).to.be.reverted;
  });
});
