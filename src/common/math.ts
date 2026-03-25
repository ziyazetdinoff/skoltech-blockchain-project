const BPS_DENOMINATOR = 10_000n;

export function calculateMinAmountOut(quoteAmountOut: bigint, slippageBps: bigint): bigint {
  if (slippageBps < 0n || slippageBps > BPS_DENOMINATOR) {
    throw new Error(`Invalid slippage bps: ${slippageBps.toString()}`);
  }

  return (quoteAmountOut * (BPS_DENOMINATOR - slippageBps)) / BPS_DENOMINATOR;
}
