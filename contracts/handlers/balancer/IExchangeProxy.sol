pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

interface IExchangeProxy {
    struct Swap {
        address pool;
        address tokenIn;
        address tokenOut;
        uint256 swapAmount; // tokenInAmount / tokenOutAmount
        uint256 limitReturnAmount; // minAmountOut / maxAmountIn
        uint256 maxPrice;
    }

    function batchSwapExactIn(
        Swap[] calldata swaps,
        address tokenIn,
        address tokenOut,
        uint256 totalAmountIn,
        uint256 minTotalAmountOut
    ) external payable returns (uint256 totalAmountOut);

    function batchSwapExactOut(
        Swap[] calldata swaps,
        address tokenIn,
        address tokenOut,
        uint256 maxTotalAmountIn
    ) external payable returns (uint256 totalAmountIn);

    function multihopBatchSwapExactIn(
        Swap[][] calldata swapSequences,
        address tokenIn,
        address tokenOut,
        uint256 totalAmountIn,
        uint256 minTotalAmountOut
    ) external payable returns (uint256 totalAmountOut);

    function multihopBatchSwapExactOut(
        Swap[][] calldata swapSequences,
        address tokenIn,
        address tokenOut,
        uint256 maxTotalAmountIn
    ) external payable returns (uint256 totalAmountIn);

    function smartSwapExactIn(
        address tokenIn,
        address tokenOut,
        uint256 totalAmountIn,
        uint256 minTotalAmountOut,
        uint256 nPools
    ) external payable returns (uint256 totalAmountOut);

    function smartSwapExactOut(
        address tokenIn,
        address tokenOut,
        uint256 totalAmountOut,
        uint256 maxTotalAmountIn,
        uint256 nPools
    ) external payable returns (uint256 totalAmountIn);
}
