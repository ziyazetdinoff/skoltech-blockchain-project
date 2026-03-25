// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ISwapRouter } from "../interfaces/ISwapRouter.sol";

contract MockSwapRouter is ISwapRouter {
    using SafeERC20 for IERC20;

    error MockSwapReverted();
    error DeadlineExpired();
    error TooLittleReceived(uint256 minimum, uint256 actual);

    uint256 public quoteAmountOut;
    bool public shouldRevert;

    event SwapExecuted(
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        address recipient
    );

    function setQuoteAmountOut(uint256 newQuoteAmountOut) external {
        quoteAmountOut = newQuoteAmountOut;
    }

    function setShouldRevert(bool newShouldRevert) external {
        shouldRevert = newShouldRevert;
    }

    function exactInputSingle(ExactInputSingleParams calldata params) external payable override returns (uint256 amountOut) {
        if (shouldRevert) {
            revert MockSwapReverted();
        }
        if (params.deadline < block.timestamp) {
            revert DeadlineExpired();
        }
        if (quoteAmountOut < params.amountOutMinimum) {
            revert TooLittleReceived(params.amountOutMinimum, quoteAmountOut);
        }

        IERC20(params.tokenIn).safeTransferFrom(msg.sender, address(this), params.amountIn);

        amountOut = quoteAmountOut;
        IERC20(params.tokenOut).safeTransfer(params.recipient, amountOut);

        emit SwapExecuted(params.tokenIn, params.tokenOut, params.amountIn, amountOut, params.recipient);
    }
}
