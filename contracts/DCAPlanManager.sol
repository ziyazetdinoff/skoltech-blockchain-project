// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ISwapRouter } from "./interfaces/ISwapRouter.sol";

contract DCAPlanManager is Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant BPS_DENOMINATOR = 10_000;

    struct Plan {
        address owner;
        address recipient;
        address tokenIn;
        address tokenOut;
        uint256 amountPerInterval;
        uint256 totalBudget;
        uint256 remainingBudget;
        uint256 intervalSeconds;
        uint256 slippageBps;
        uint256 startTime;
        uint256 nextExecutionTime;
        bool active;
        bool paused;
        bool canceled;
    }

    error ZeroAddress(string fieldName);
    error InvalidAmount(string fieldName);
    error InvalidInterval();
    error InvalidSlippage(uint256 provided, uint256 maxAllowed);
    error InvalidBudget(uint256 totalBudget, uint256 amountPerInterval);
    error InvalidTokenPair();
    error PlanNotFound(uint256 planId);
    error NotPlanOwner(uint256 planId, address caller);
    error PlanAlreadyPaused(uint256 planId);
    error PlanNotPaused(uint256 planId);
    error PlanAlreadyCanceled(uint256 planId);
    error PlanNotExecutable(uint256 planId);
    error WithdrawOnlyAfterCancel(uint256 planId);
    error InvalidWithdrawAmount(uint256 planId, uint256 requested, uint256 available);
    error InvalidPoolFee();

    event PlanCreated(uint256 indexed planId, address indexed owner);
    event PlanPaused(uint256 indexed planId);
    event PlanResumed(uint256 indexed planId);
    event PlanCanceled(uint256 indexed planId);
    event PlanToppedUp(uint256 indexed planId, uint256 amount);
    event UnusedFundsWithdrawn(uint256 indexed planId, uint256 amount);
    event PlanUpdated(
        uint256 indexed planId,
        uint256 amountPerInterval,
        uint256 intervalSeconds,
        uint256 slippageBps
    );
    event PlanExecuted(
        uint256 indexed planId,
        uint256 amountIn,
        uint256 amountOut,
        uint256 executionTime
    );

    ISwapRouter public immutable swapRouter;
    uint24 public immutable poolFee;
    uint256 public immutable maxSlippageBps;

    uint256 public nextPlanId;
    mapping(uint256 => Plan) private plans;

    constructor(address router_, uint24 poolFee_, uint256 maxSlippageBps_) Ownable(msg.sender) {
        if (router_ == address(0)) {
            revert ZeroAddress("router");
        }
        if (poolFee_ == 0) {
            revert InvalidPoolFee();
        }
        if (maxSlippageBps_ == 0 || maxSlippageBps_ > BPS_DENOMINATOR) {
            revert InvalidSlippage(maxSlippageBps_, BPS_DENOMINATOR);
        }

        swapRouter = ISwapRouter(router_);
        poolFee = poolFee_;
        maxSlippageBps = maxSlippageBps_;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function createPlan(
        address tokenIn,
        address tokenOut,
        uint256 amountPerInterval,
        uint256 totalBudget,
        uint256 intervalSeconds,
        uint256 slippageBps,
        address recipient,
        uint256 startTime
    ) external whenNotPaused nonReentrant returns (uint256 planId) {
        _validatePlanInput(
            tokenIn,
            tokenOut,
            amountPerInterval,
            totalBudget,
            intervalSeconds,
            slippageBps,
            recipient
        );

        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), totalBudget);

        uint256 normalizedStartTime = startTime == 0 ? block.timestamp : startTime;
        uint256 initialExecutionTime = normalizedStartTime > block.timestamp ? normalizedStartTime : block.timestamp;

        planId = nextPlanId;
        nextPlanId = planId + 1;

        plans[planId] = Plan({
            owner: msg.sender,
            recipient: recipient,
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            amountPerInterval: amountPerInterval,
            totalBudget: totalBudget,
            remainingBudget: totalBudget,
            intervalSeconds: intervalSeconds,
            slippageBps: slippageBps,
            startTime: normalizedStartTime,
            nextExecutionTime: initialExecutionTime,
            active: true,
            paused: false,
            canceled: false
        });

        emit PlanCreated(planId, msg.sender);
    }

    function pausePlan(uint256 planId) external onlyPlanOwner(planId) {
        Plan storage plan = plans[planId];

        if (plan.canceled || !plan.active) {
            revert PlanAlreadyCanceled(planId);
        }
        if (plan.paused) {
            revert PlanAlreadyPaused(planId);
        }

        plan.paused = true;
        emit PlanPaused(planId);
    }

    function resumePlan(uint256 planId) external onlyPlanOwner(planId) whenNotPaused {
        Plan storage plan = plans[planId];

        if (plan.canceled || !plan.active) {
            revert PlanAlreadyCanceled(planId);
        }
        if (!plan.paused) {
            revert PlanNotPaused(planId);
        }

        plan.paused = false;
        emit PlanResumed(planId);
    }

    function cancelPlan(uint256 planId) external onlyPlanOwner(planId) nonReentrant {
        Plan storage plan = plans[planId];

        if (plan.canceled) {
            revert PlanAlreadyCanceled(planId);
        }

        plan.canceled = true;
        plan.active = false;
        plan.paused = false;

        emit PlanCanceled(planId);
    }

    function topUpPlan(uint256 planId, uint256 amount) external onlyPlanOwner(planId) whenNotPaused nonReentrant {
        Plan storage plan = plans[planId];

        if (plan.canceled) {
            revert PlanAlreadyCanceled(planId);
        }
        if (amount == 0) {
            revert InvalidAmount("topUpAmount");
        }

        IERC20(plan.tokenIn).safeTransferFrom(msg.sender, address(this), amount);

        plan.totalBudget += amount;
        plan.remainingBudget += amount;

        emit PlanToppedUp(planId, amount);
    }

    function withdrawUnusedFunds(uint256 planId, uint256 amount) external onlyPlanOwner(planId) nonReentrant {
        Plan storage plan = plans[planId];

        if (!plan.canceled) {
            revert WithdrawOnlyAfterCancel(planId);
        }
        if (amount == 0 || amount > plan.remainingBudget) {
            revert InvalidWithdrawAmount(planId, amount, plan.remainingBudget);
        }

        plan.remainingBudget -= amount;
        IERC20(plan.tokenIn).safeTransfer(plan.owner, amount);

        emit UnusedFundsWithdrawn(planId, amount);
    }

    function updatePlan(
        uint256 planId,
        uint256 newAmountPerInterval,
        uint256 newIntervalSeconds,
        uint256 newSlippageBps
    ) external onlyPlanOwner(planId) whenNotPaused nonReentrant {
        Plan storage plan = plans[planId];

        if (plan.canceled) {
            revert PlanAlreadyCanceled(planId);
        }
        if (newAmountPerInterval == 0) {
            revert InvalidAmount("amountPerInterval");
        }
        if (newIntervalSeconds == 0) {
            revert InvalidInterval();
        }
        if (newSlippageBps > maxSlippageBps) {
            revert InvalidSlippage(newSlippageBps, maxSlippageBps);
        }

        plan.amountPerInterval = newAmountPerInterval;
        plan.intervalSeconds = newIntervalSeconds;
        plan.slippageBps = newSlippageBps;

        emit PlanUpdated(planId, newAmountPerInterval, newIntervalSeconds, newSlippageBps);
    }

    function canExecute(uint256 planId) external view returns (bool) {
        if (paused()) {
            return false;
        }

        Plan storage plan = plans[planId];
        if (!_exists(plan)) {
            return false;
        }

        return _isExecutable(plan);
    }

    function executePlan(uint256 planId, uint256 minAmountOut, uint256 deadline)
        external
        whenNotPaused
        nonReentrant
    {
        Plan storage plan = _getExistingPlan(planId);

        if (!_isExecutable(plan)) {
            revert PlanNotExecutable(planId);
        }

        IERC20 tokenIn = IERC20(plan.tokenIn);
        tokenIn.forceApprove(address(swapRouter), 0);
        tokenIn.forceApprove(address(swapRouter), plan.amountPerInterval);

        uint256 amountOut = swapRouter.exactInputSingle(
            ISwapRouter.ExactInputSingleParams({
                tokenIn: plan.tokenIn,
                tokenOut: plan.tokenOut,
                fee: poolFee,
                recipient: address(this),
                deadline: deadline,
                amountIn: plan.amountPerInterval,
                amountOutMinimum: minAmountOut,
                sqrtPriceLimitX96: 0
            })
        );

        tokenIn.forceApprove(address(swapRouter), 0);

        plan.remainingBudget -= plan.amountPerInterval;
        plan.nextExecutionTime = block.timestamp + plan.intervalSeconds;

        IERC20(plan.tokenOut).safeTransfer(plan.recipient, amountOut);

        emit PlanExecuted(planId, plan.amountPerInterval, amountOut, block.timestamp);
    }

    function getPlan(uint256 planId) external view returns (Plan memory) {
        return _getExistingPlan(planId);
    }

    function getPlanStatus(uint256 planId) external view returns (string memory) {
        Plan storage plan = _getExistingPlan(planId);

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

    function _validatePlanInput(
        address tokenIn,
        address tokenOut,
        uint256 amountPerInterval,
        uint256 totalBudget,
        uint256 intervalSeconds,
        uint256 slippageBps,
        address recipient
    ) private view {
        if (tokenIn == address(0)) {
            revert ZeroAddress("tokenIn");
        }
        if (tokenOut == address(0)) {
            revert ZeroAddress("tokenOut");
        }
        if (recipient == address(0)) {
            revert ZeroAddress("recipient");
        }
        if (tokenIn == tokenOut) {
            revert InvalidTokenPair();
        }
        if (amountPerInterval == 0) {
            revert InvalidAmount("amountPerInterval");
        }
        if (totalBudget < amountPerInterval) {
            revert InvalidBudget(totalBudget, amountPerInterval);
        }
        if (intervalSeconds == 0) {
            revert InvalidInterval();
        }
        if (slippageBps > maxSlippageBps) {
            revert InvalidSlippage(slippageBps, maxSlippageBps);
        }
    }

    function _getExistingPlan(uint256 planId) private view returns (Plan storage plan) {
        plan = plans[planId];
        if (!_exists(plan)) {
            revert PlanNotFound(planId);
        }
    }

    function _exists(Plan storage plan) private view returns (bool) {
        return plan.owner != address(0);
    }

    function _isExecutable(Plan storage plan) private view returns (bool) {
        return
            plan.active &&
            !plan.paused &&
            !plan.canceled &&
            block.timestamp >= plan.nextExecutionTime &&
            plan.remainingBudget >= plan.amountPerInterval;
    }

    modifier onlyPlanOwner(uint256 planId) {
        Plan storage plan = _getExistingPlan(planId);
        if (plan.owner != msg.sender) {
            revert NotPlanOwner(planId, msg.sender);
        }
        _;
    }
}
