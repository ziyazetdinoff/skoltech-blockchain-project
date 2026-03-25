// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract MockQuoter {
    struct QuoteExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        uint24 fee;
        uint160 sqrtPriceLimitX96;
    }

    uint256 public quoteAmountOut;
    bool public shouldRevert;

    error MockQuoteReverted();

    function setQuoteAmountOut(uint256 newQuoteAmountOut) external {
        quoteAmountOut = newQuoteAmountOut;
    }

    function setShouldRevert(bool newShouldRevert) external {
        shouldRevert = newShouldRevert;
    }

    function quoteExactInputSingle(
        address,
        address,
        uint24,
        uint256,
        uint160
    ) external view returns (uint256 amountOut) {
        if (shouldRevert) {
            revert MockQuoteReverted();
        }

        return quoteAmountOut;
    }

    function quoteExactInputSingle(QuoteExactInputSingleParams calldata)
        external
        view
        returns (uint256 amountOut, uint160, uint32, uint256)
    {
        if (shouldRevert) {
            revert MockQuoteReverted();
        }

        return (quoteAmountOut, 0, 0, 0);
    }
}
