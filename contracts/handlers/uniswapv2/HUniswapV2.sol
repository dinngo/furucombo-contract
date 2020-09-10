pragma solidity ^0.5.0;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "../HandlerBase.sol";
import "./libraries/UniswapV2Library.sol";
import "./IUniswapV2Router02.sol";

contract HUniswapV2 is HandlerBase {
    using SafeERC20 for IERC20;

    address constant UNISWAPV2_ROUTER = 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D;

    function addLiquidityETH(
        uint256 value,
        address token,
        uint256 amountTokenDesired,
        uint256 amountTokenMin,
        uint256 amountETHMin
    )
        external
        payable
        returns (
            uint256 amountToken,
            uint256 amountETH,
            uint256 liquidity
        )
    {
        // Get uniswapV2 router
        IUniswapV2Router02 router = IUniswapV2Router02(UNISWAPV2_ROUTER);

        // Approve token
        IERC20(token).safeApprove(UNISWAPV2_ROUTER, amountTokenDesired);

        // Add liquidity ETH
        (amountToken, amountETH, liquidity) = router.addLiquidityETH.value(
            value
        )(
            token,
            amountTokenDesired,
            amountTokenMin,
            amountETHMin,
            address(this),
            now + 1
        );

        // Approve token 0
        IERC20(token).safeApprove(UNISWAPV2_ROUTER, 0);

        // Update involved token
        address pair = UniswapV2Library.pairFor(
            router.factory(),
            token,
            router.WETH()
        );
        _updateToken(pair);
    }

    function addLiquidity(
        address tokenA,
        address tokenB,
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 amountAMin,
        uint256 amountBMin
    )
        external
        payable
        returns (
            uint256 amountA,
            uint256 amountB,
            uint256 liquidity
        )
    {
        // Get uniswapV2 router
        IUniswapV2Router02 router = IUniswapV2Router02(UNISWAPV2_ROUTER);

        // Approve token
        IERC20(tokenA).safeApprove(UNISWAPV2_ROUTER, amountADesired);
        IERC20(tokenB).safeApprove(UNISWAPV2_ROUTER, amountBDesired);

        // Add liquidity
        (amountA, amountB, liquidity) = router.addLiquidity(
            tokenA,
            tokenB,
            amountADesired,
            amountBDesired,
            amountAMin,
            amountBMin,
            address(this),
            now + 1
        );

        // Approve token 0
        IERC20(tokenA).safeApprove(UNISWAPV2_ROUTER, 0);
        IERC20(tokenB).safeApprove(UNISWAPV2_ROUTER, 0);

        // Update involved token
        address pair = UniswapV2Library.pairFor(
            router.factory(),
            tokenA,
            tokenB
        );
        _updateToken(pair);
    }

    function removeLiquidityETH(
        address token,
        uint256 liquidity,
        uint256 amountTokenMin,
        uint256 amountETHMin
    ) external payable returns (uint256 amountToken, uint256 amountETH) {
        // Get uniswapV2 router
        IUniswapV2Router02 router = IUniswapV2Router02(UNISWAPV2_ROUTER);
        address pair = UniswapV2Library.pairFor(
            router.factory(),
            token,
            router.WETH()
        );

        // Approve token
        IERC20(pair).safeApprove(UNISWAPV2_ROUTER, liquidity);

        // Add liquidity ETH
        (amountToken, amountETH) = router.removeLiquidityETH(
            token,
            liquidity,
            amountTokenMin,
            amountETHMin,
            address(this),
            now + 1
        );

        // Approve token 0
        IERC20(pair).safeApprove(UNISWAPV2_ROUTER, 0);

        // Update involved token
        _updateToken(token);
    }

    function removeLiquidity(
        address tokenA,
        address tokenB,
        uint256 liquidity,
        uint256 amountAMin,
        uint256 amountBMin
    ) external payable returns (uint256 amountA, uint256 amountB) {
        // Get uniswapV2 router
        IUniswapV2Router02 router = IUniswapV2Router02(UNISWAPV2_ROUTER);
        address pair = UniswapV2Library.pairFor(
            router.factory(),
            tokenA,
            tokenB
        );

        // Approve token
        IERC20(pair).safeApprove(UNISWAPV2_ROUTER, liquidity);

        // Add liquidity ETH
        (amountA, amountB) = router.removeLiquidity(
            tokenA,
            tokenB,
            liquidity,
            amountAMin,
            amountBMin,
            address(this),
            now + 1
        );

        // Approve token 0
        IERC20(pair).safeApprove(UNISWAPV2_ROUTER, 0);

        // Update involved token
        _updateToken(tokenA);
        _updateToken(tokenB);
    }

    function swapExactETHForTokens(
        uint256 value,
        uint256 amountOutMin,
        address[] calldata path
    ) external payable returns (uint256[] memory amounts) {
        require(path.length >= 2, "invalid path");
        address tokenOut = path[path.length - 1];

        // Get uniswapV2 router
        IUniswapV2Router02 router = IUniswapV2Router02(UNISWAPV2_ROUTER);

        amounts = router.swapExactETHForTokens.value(value)(
            amountOutMin,
            path,
            address(this),
            now + 1
        );

        _updateToken(tokenOut);
    }

    function swapETHForExactTokens(
        uint256 value,
        uint256 amountOut,
        address[] calldata path
    ) external payable returns (uint256[] memory amounts) {
        require(path.length >= 2, "invalid path");
        address tokenOut = path[path.length - 1];

        // Get uniswapV2 router
        IUniswapV2Router02 router = IUniswapV2Router02(UNISWAPV2_ROUTER);

        amounts = router.swapETHForExactTokens.value(value)(
            amountOut,
            path,
            address(this),
            now + 1
        );

        _updateToken(tokenOut);
    }

    function swapExactTokensForETH(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path
    ) external payable returns (uint256[] memory amounts) {
        require(path.length >= 2, "invalid path");
        address tokenIn = path[0];

        // Get uniswapV2 router
        IUniswapV2Router02 router = IUniswapV2Router02(UNISWAPV2_ROUTER);

        // Approve token
        IERC20(tokenIn).safeApprove(UNISWAPV2_ROUTER, amountIn);

        amounts = router.swapExactTokensForETH(
            amountIn,
            amountOutMin,
            path,
            address(this),
            now + 1
        );

        // Approve token 0
        IERC20(tokenIn).safeApprove(UNISWAPV2_ROUTER, 0);
    }

    function swapTokensForExactETH(
        uint256 amountOut,
        uint256 amountInMax,
        address[] calldata path
    ) external payable returns (uint256[] memory amounts) {
        require(path.length >= 2, "invalid path");
        address tokenIn = path[0];

        // Get uniswapV2 router
        IUniswapV2Router02 router = IUniswapV2Router02(UNISWAPV2_ROUTER);

        // Approve token
        IERC20(tokenIn).safeApprove(UNISWAPV2_ROUTER, amountInMax);

        amounts = router.swapTokensForExactETH(
            amountOut,
            amountInMax,
            path,
            address(this),
            now + 1
        );

        // Approve token 0
        IERC20(tokenIn).safeApprove(UNISWAPV2_ROUTER, 0);
    }

    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path
    ) external payable returns (uint256[] memory amounts) {
        require(path.length >= 2, "invalid path");
        address tokenIn = path[0];
        address tokenOut = path[path.length - 1];

        // Get uniswapV2 router
        IUniswapV2Router02 router = IUniswapV2Router02(UNISWAPV2_ROUTER);

        // Approve token
        IERC20(tokenIn).safeApprove(UNISWAPV2_ROUTER, amountIn);

        amounts = router.swapExactTokensForTokens(
            amountIn,
            amountOutMin,
            path,
            address(this),
            now + 1
        );

        // Approve token 0
        IERC20(tokenIn).safeApprove(UNISWAPV2_ROUTER, 0);

        _updateToken(tokenOut);
    }

    function swapTokensForExactTokens(
        uint256 amountOut,
        uint256 amountInMax,
        address[] calldata path
    ) external payable returns (uint256[] memory amounts) {
        require(path.length >= 2, "invalid path");
        address tokenIn = path[0];
        address tokenOut = path[path.length - 1];

        // Get uniswapV2 router
        IUniswapV2Router02 router = IUniswapV2Router02(UNISWAPV2_ROUTER);

        // Approve token
        IERC20(tokenIn).safeApprove(UNISWAPV2_ROUTER, amountInMax);

        amounts = router.swapTokensForExactTokens(
            amountOut,
            amountInMax,
            path,
            address(this),
            now + 1
        );

        // Approve token 0
        IERC20(tokenIn).safeApprove(UNISWAPV2_ROUTER, 0);

        _updateToken(tokenOut);
    }
}
