export const DCA_PLAN_MANAGER_ABI = [
  "function nextPlanId() view returns (uint256)",
  "function poolFee() view returns (uint24)",
  "function maxSlippageBps() view returns (uint256)",
  "function createPlan(address tokenIn,address tokenOut,uint256 amountPerInterval,uint256 totalBudget,uint256 intervalSeconds,uint256 slippageBps,address recipient,uint256 startTime) returns (uint256 planId)",
  "function pausePlan(uint256 planId)",
  "function resumePlan(uint256 planId)",
  "function cancelPlan(uint256 planId)",
  "function topUpPlan(uint256 planId,uint256 amount)",
  "function withdrawUnusedFunds(uint256 planId,uint256 amount)",
  "function updatePlan(uint256 planId,uint256 newAmountPerInterval,uint256 newIntervalSeconds,uint256 newSlippageBps)",
  "function canExecute(uint256 planId) view returns (bool)",
  "function executePlan(uint256 planId,uint256 minAmountOut,uint256 deadline)",
  "function getPlan(uint256 planId) view returns (tuple(address owner,address recipient,address tokenIn,address tokenOut,uint256 amountPerInterval,uint256 totalBudget,uint256 remainingBudget,uint256 intervalSeconds,uint256 slippageBps,uint256 startTime,uint256 nextExecutionTime,bool active,bool paused,bool canceled))",
  "function getPlanStatus(uint256 planId) view returns (string)",
] as const;

export const ERC20_ABI = [
  "function approve(address spender,uint256 amount) returns (bool)",
  "function allowance(address owner,address spender) view returns (uint256)",
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function name() view returns (string)",
] as const;

export const QUOTER_V1_ABI = [
  "function quoteExactInputSingle(address tokenIn,address tokenOut,uint24 fee,uint256 amountIn,uint160 sqrtPriceLimitX96) returns (uint256 amountOut)",
] as const;

export const QUOTER_V2_ABI = [
  "function quoteExactInputSingle(tuple(address tokenIn,address tokenOut,uint256 amountIn,uint24 fee,uint160 sqrtPriceLimitX96) params) returns (uint256 amountOut,uint160 sqrtPriceX96After,uint32 initializedTicksCrossed,uint256 gasEstimate)",
] as const;
