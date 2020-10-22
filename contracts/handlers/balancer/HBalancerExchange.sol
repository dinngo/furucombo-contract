pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import "./IExchangeProxy.sol";
import "../HandlerBase.sol";

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

contract HBalancerExchange is HandlerBase {
    using SafeERC20 for IERC20;

    // prettier-ignore
    address public constant EXCHANGE_PROXY = 0x3E66B66Fd1d0b02fDa6C811Da9E0547970DB2f21;
    // prettier-ignore
    address public constant ETH_ADDRESS = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    function batchSwapExactIn(
        IExchangeProxy.Swap[] calldata swaps,
        address tokenIn,
        address tokenOut,
        uint256 totalAmountIn,
        uint256 minTotalAmountOut
    ) external payable returns (uint256 totalAmountOut) {
        IExchangeProxy balancer = IExchangeProxy(EXCHANGE_PROXY);

        if (tokenIn == ETH_ADDRESS) {
            totalAmountOut = balancer.batchSwapExactIn.value(totalAmountIn)(
                swaps,
                tokenIn,
                tokenOut,
                totalAmountIn,
                minTotalAmountOut
            );
        } else {
            IERC20(tokenIn).safeApprove(EXCHANGE_PROXY, totalAmountIn);
            totalAmountOut = balancer.batchSwapExactIn(
                swaps,
                tokenIn,
                tokenOut,
                totalAmountIn,
                minTotalAmountOut
            );
            IERC20(tokenIn).safeApprove(EXCHANGE_PROXY, 0);
        }

        if (tokenOut != ETH_ADDRESS) _updateToken(tokenOut);
    }

    function batchSwapExactOut(
        IExchangeProxy.Swap[] calldata swaps,
        address tokenIn,
        address tokenOut,
        uint256 maxTotalAmountIn
    ) external payable returns (uint256 totalAmountIn) {
        IExchangeProxy balancer = IExchangeProxy(EXCHANGE_PROXY);

        if (tokenIn == ETH_ADDRESS) {
            totalAmountIn = balancer.batchSwapExactOut.value(maxTotalAmountIn)(
                swaps,
                tokenIn,
                tokenOut,
                maxTotalAmountIn
            );
        } else {
            IERC20(tokenIn).safeApprove(EXCHANGE_PROXY, maxTotalAmountIn);
            totalAmountIn = balancer.batchSwapExactOut(
                swaps,
                tokenIn,
                tokenOut,
                maxTotalAmountIn
            );
            IERC20(tokenIn).safeApprove(EXCHANGE_PROXY, 0);
        }

        if (tokenOut != ETH_ADDRESS) _updateToken(tokenOut);
    }

    function multihopBatchSwapExactIn(
        IExchangeProxy.Swap[][] calldata swapSequences,
        address tokenIn,
        address tokenOut,
        uint256 totalAmountIn,
        uint256 minTotalAmountOut
    ) external payable returns (uint256 totalAmountOut) {
        IExchangeProxy balancer = IExchangeProxy(EXCHANGE_PROXY);

        if (tokenIn == ETH_ADDRESS) {
            totalAmountOut = balancer.multihopBatchSwapExactIn.value(
                totalAmountIn
            )(
                swapSequences,
                tokenIn,
                tokenOut,
                totalAmountIn,
                minTotalAmountOut
            );
        } else {
            IERC20(tokenIn).safeApprove(EXCHANGE_PROXY, totalAmountIn);
            totalAmountOut = balancer.multihopBatchSwapExactIn(
                swapSequences,
                tokenIn,
                tokenOut,
                totalAmountIn,
                minTotalAmountOut
            );
            IERC20(tokenIn).safeApprove(EXCHANGE_PROXY, 0);
        }

        if (tokenOut != ETH_ADDRESS) _updateToken(tokenOut);
    }

    function multihopBatchSwapExactOut(
        IExchangeProxy.Swap[][] calldata swapSequences,
        address tokenIn,
        address tokenOut,
        uint256 maxTotalAmountIn
    ) external payable returns (uint256 totalAmountIn) {
        IExchangeProxy balancer = IExchangeProxy(EXCHANGE_PROXY);

        if (tokenIn == ETH_ADDRESS) {
            totalAmountIn = balancer.multihopBatchSwapExactOut.value(
                maxTotalAmountIn
            )(swapSequences, tokenIn, tokenOut, maxTotalAmountIn);
        } else {
            IERC20(tokenIn).safeApprove(EXCHANGE_PROXY, maxTotalAmountIn);
            totalAmountIn = balancer.multihopBatchSwapExactOut(
                swapSequences,
                tokenIn,
                tokenOut,
                maxTotalAmountIn
            );
            IERC20(tokenIn).safeApprove(EXCHANGE_PROXY, 0);
        }

        if (tokenOut != ETH_ADDRESS) _updateToken(tokenOut);
    }

    function smartSwapExactIn(
        address tokenIn,
        address tokenOut,
        uint256 totalAmountIn,
        uint256 minTotalAmountOut,
        uint256 nPools
    ) external payable returns (uint256 totalAmountOut) {
        IExchangeProxy balancer = IExchangeProxy(EXCHANGE_PROXY);

        if (tokenIn == ETH_ADDRESS) {
            totalAmountOut = balancer.smartSwapExactIn.value(totalAmountIn)(
                tokenIn,
                tokenOut,
                totalAmountIn,
                minTotalAmountOut,
                nPools
            );
        } else {
            IERC20(tokenIn).safeApprove(EXCHANGE_PROXY, totalAmountIn);
            totalAmountOut = balancer.smartSwapExactIn(
                tokenIn,
                tokenOut,
                totalAmountIn,
                minTotalAmountOut,
                nPools
            );
            IERC20(tokenIn).safeApprove(EXCHANGE_PROXY, 0);
        }

        if (tokenOut != ETH_ADDRESS) _updateToken(tokenOut);
    }

    function smartSwapExactOut(
        address tokenIn,
        address tokenOut,
        uint256 totalAmountOut,
        uint256 maxTotalAmountIn,
        uint256 nPools
    ) external payable returns (uint256 totalAmountIn) {
        IExchangeProxy balancer = IExchangeProxy(EXCHANGE_PROXY);

        if (tokenIn == ETH_ADDRESS) {
            totalAmountIn = balancer.smartSwapExactOut.value(maxTotalAmountIn)(
                tokenIn,
                tokenOut,
                totalAmountOut,
                maxTotalAmountIn,
                nPools
            );
        } else {
            IERC20(tokenIn).safeApprove(EXCHANGE_PROXY, maxTotalAmountIn);
            totalAmountIn = balancer.smartSwapExactOut(
                tokenIn,
                tokenOut,
                totalAmountOut,
                maxTotalAmountIn,
                nPools
            );
            IERC20(tokenIn).safeApprove(EXCHANGE_PROXY, 0);
        }

        if (tokenOut != ETH_ADDRESS) _updateToken(tokenOut);
    }
}
