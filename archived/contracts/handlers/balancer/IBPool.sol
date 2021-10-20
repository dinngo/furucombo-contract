pragma solidity ^0.6.0;

interface IBPool {
    function isBound(address t) external view returns (bool);

    function getFinalTokens() external view returns (address[] memory);

    function getBalance(address token) external view returns (uint256);

    function setSwapFee(uint256 swapFee) external;

    function setController(address controller) external;

    function setPublicSwap(bool public_) external;

    function finalize() external;

    function totalSupply() external view returns (uint256);

    function bind(
        address token,
        uint256 balance,
        uint256 denorm
    ) external;

    function rebind(
        address token,
        uint256 balance,
        uint256 denorm
    ) external;

    function unbind(address token) external;

    function joinPool(uint256 poolAmountOut, uint256[] calldata maxAmountsIn)
        external;

    function joinswapExternAmountIn(
        address tokenIn,
        uint256 tokenAmountIn,
        uint256 minPoolAmountOut
    ) external returns (uint256 poolAmountOut);

    function exitswapPoolAmountIn(
        address tokenOut,
        uint256 poolAmountIn,
        uint256 minAmountOut
    ) external payable returns (uint256 tokenAmountOut);

    function exitPool(uint256 poolAmountIn, uint256[] calldata minAmountsOut)
        external;
}
