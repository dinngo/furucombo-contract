pragma solidity ^0.6.0;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

import "../HandlerBase.sol";
import "./libraries/UniswapV2Library.sol";
import "./IUniswapV2Router02.sol";

contract HUniswapV2 is HandlerBase {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    // prettier-ignore
    address public constant UNISWAPV2_ROUTER = 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D;

    function getContractName() public pure override returns (string memory) {
        return "HUniswapV2";
    }

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
        value = _getBalance(address(0), value);
        amountTokenDesired = _getBalance(token, amountTokenDesired);
        IERC20(token).safeApprove(UNISWAPV2_ROUTER, amountTokenDesired);

        // Add liquidity ETH
        try
            router.addLiquidityETH{value: value}(
                token,
                amountTokenDesired,
                amountTokenMin,
                amountETHMin,
                address(this),
                now + 1
            )
        returns (uint256 ret1, uint256 ret2, uint256 ret3) {
            amountToken = ret1;
            amountETH = ret2;
            liquidity = ret3;
        } catch Error(string memory reason) {
            _revertMsg("addLiquidityETH", reason);
        } catch {
            _revertMsg("addLiquidityETH");
        }

        // Approve token 0
        IERC20(token).safeApprove(UNISWAPV2_ROUTER, 0);

        // Update involved token
        address pair =
            UniswapV2Library.pairFor(router.factory(), token, router.WETH());
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
        amountADesired = _getBalance(tokenA, amountADesired);
        amountBDesired = _getBalance(tokenB, amountBDesired);
        IERC20(tokenA).safeApprove(UNISWAPV2_ROUTER, amountADesired);
        IERC20(tokenB).safeApprove(UNISWAPV2_ROUTER, amountBDesired);

        // Add liquidity
        try
            router.addLiquidity(
                tokenA,
                tokenB,
                amountADesired,
                amountBDesired,
                amountAMin,
                amountBMin,
                address(this),
                now + 1
            )
        returns (uint256 ret1, uint256 ret2, uint256 ret3) {
            amountA = ret1;
            amountB = ret2;
            liquidity = ret3;
        } catch Error(string memory reason) {
            _revertMsg("addLiquidity", reason);
        } catch {
            _revertMsg("addLiquidity");
        }

        // Approve token 0
        IERC20(tokenA).safeApprove(UNISWAPV2_ROUTER, 0);
        IERC20(tokenB).safeApprove(UNISWAPV2_ROUTER, 0);

        // Update involved token
        address pair =
            UniswapV2Library.pairFor(router.factory(), tokenA, tokenB);
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
        address pair =
            UniswapV2Library.pairFor(router.factory(), token, router.WETH());

        // Approve token
        liquidity = _getBalance(pair, liquidity);
        IERC20(pair).safeApprove(UNISWAPV2_ROUTER, liquidity);

        // remove liquidityETH
        try
            router.removeLiquidityETH(
                token,
                liquidity,
                amountTokenMin,
                amountETHMin,
                address(this),
                now + 1
            )
        returns (uint256 ret1, uint256 ret2) {
            amountToken = ret1;
            amountETH = ret2;
        } catch Error(string memory reason) {
            _revertMsg("removeLiquidityETH", reason);
        } catch {
            _revertMsg("removeLiquidityETH");
        }

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
        address pair =
            UniswapV2Library.pairFor(router.factory(), tokenA, tokenB);

        // Approve token
        liquidity = _getBalance(pair, liquidity);
        IERC20(pair).safeApprove(UNISWAPV2_ROUTER, liquidity);

        // remove liquidity
        try
            router.removeLiquidity(
                tokenA,
                tokenB,
                liquidity,
                amountAMin,
                amountBMin,
                address(this),
                now + 1
            )
        returns (uint256 ret1, uint256 ret2) {
            amountA = ret1;
            amountB = ret2;
        } catch Error(string memory reason) {
            _revertMsg("removeLiquidity", reason);
        } catch {
            _revertMsg("removeLiquidity");
        }

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
    ) external payable returns (uint256 amount) {
        if (path.length < 2)
            _revertMsg("swapExactETHForTokens", "invalid path");
        address tokenOut = path[path.length - 1];

        // Get uniswapV2 router
        IUniswapV2Router02 router = IUniswapV2Router02(UNISWAPV2_ROUTER);
        value = _getBalance(address(0), value);
        try
            router.swapExactETHForTokens{value: value}(
                amountOutMin,
                path,
                address(this),
                now + 1
            )
        returns (uint256[] memory amounts) {
            amount = amounts[amounts.length - 1];
        } catch Error(string memory reason) {
            _revertMsg("swapExactETHForTokens", reason);
        } catch {
            _revertMsg("swapExactETHForTokens");
        }

        _updateToken(tokenOut);
    }

    function swapETHForExactTokens(
        uint256 value,
        uint256 amountOut,
        address[] calldata path
    ) external payable returns (uint256 amount) {
        if (path.length < 2)
            _revertMsg("swapETHForExactTokens", "invalid path");
        address tokenOut = path[path.length - 1];

        // Get uniswapV2 router
        IUniswapV2Router02 router = IUniswapV2Router02(UNISWAPV2_ROUTER);

        // if amount == uint256(-1) return balance of Proxy
        value = _getBalance(address(0), value);

        try
            router.swapETHForExactTokens{value: value}(
                amountOut,
                path,
                address(this),
                now + 1
            )
        returns (uint256[] memory amounts) {
            amount = amounts[0];
        } catch Error(string memory reason) {
            _revertMsg("swapETHForExactTokens", reason);
        } catch {
            _revertMsg("swapETHForExactTokens");
        }

        _updateToken(tokenOut);
    }

    function swapExactTokensForETH(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path
    ) external payable returns (uint256 amount) {
        if (path.length < 2)
            _revertMsg("swapExactTokensForETH", "invalid path");
        address tokenIn = path[0];

        // Get uniswapV2 router
        IUniswapV2Router02 router = IUniswapV2Router02(UNISWAPV2_ROUTER);

        // Approve token
        amountIn = _getBalance(tokenIn, amountIn);
        IERC20(tokenIn).safeApprove(UNISWAPV2_ROUTER, amountIn);

        try
            router.swapExactTokensForETH(
                amountIn,
                amountOutMin,
                path,
                address(this),
                now + 1
            )
        returns (uint256[] memory amounts) {
            amount = amounts[amounts.length - 1];
        } catch Error(string memory reason) {
            _revertMsg("swapExactTokensForETH", reason);
        } catch {
            _revertMsg("swapExactTokensForETH");
        }

        // Approve token 0
        IERC20(tokenIn).safeApprove(UNISWAPV2_ROUTER, 0);
    }

    function swapTokensForExactETH(
        uint256 amountOut,
        uint256 amountInMax,
        address[] calldata path
    ) external payable returns (uint256 amount) {
        if (path.length < 2)
            _revertMsg("swapTokensForExactETH", "invalid path");
        address tokenIn = path[0];

        // Get uniswapV2 router
        IUniswapV2Router02 router = IUniswapV2Router02(UNISWAPV2_ROUTER);

        // if amount == uint256(-1) return balance of Proxy
        amountInMax = _getBalance(tokenIn, amountInMax);

        // Approve token
        IERC20(tokenIn).safeApprove(UNISWAPV2_ROUTER, amountInMax);

        try
            router.swapTokensForExactETH(
                amountOut,
                amountInMax,
                path,
                address(this),
                now + 1
            )
        returns (uint256[] memory amounts) {
            amount = amounts[0];
        } catch Error(string memory reason) {
            _revertMsg("swapTokensForExactETH", reason);
        } catch {
            _revertMsg("swapTokensForExactETH");
        }

        // Approve token 0
        IERC20(tokenIn).safeApprove(UNISWAPV2_ROUTER, 0);
    }

    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path
    ) external payable returns (uint256 amount) {
        if (path.length < 2)
            _revertMsg("swapExactTokensForTokens", "invalid path");
        address tokenIn = path[0];
        address tokenOut = path[path.length - 1];

        // Get uniswapV2 router
        IUniswapV2Router02 router = IUniswapV2Router02(UNISWAPV2_ROUTER);

        // Approve token
        amountIn = _getBalance(tokenIn, amountIn);
        IERC20(tokenIn).safeApprove(UNISWAPV2_ROUTER, amountIn);

        try
            router.swapExactTokensForTokens(
                amountIn,
                amountOutMin,
                path,
                address(this),
                now + 1
            )
        returns (uint256[] memory amounts) {
            amount = amounts[amounts.length - 1];
        } catch Error(string memory reason) {
            _revertMsg("swapExactTokensForTokens", reason);
        } catch {
            _revertMsg("swapExactTokensForTokens");
        }

        // Approve token 0
        IERC20(tokenIn).safeApprove(UNISWAPV2_ROUTER, 0);

        _updateToken(tokenOut);
    }

    function swapTokensForExactTokens(
        uint256 amountOut,
        uint256 amountInMax,
        address[] calldata path
    ) external payable returns (uint256 amount) {
        if (path.length < 2)
            _revertMsg("swapTokensForExactTokens", "invalid path");
        address tokenIn = path[0];
        address tokenOut = path[path.length - 1];

        // Get uniswapV2 router
        IUniswapV2Router02 router = IUniswapV2Router02(UNISWAPV2_ROUTER);

        // if amount == uint256(-1) return balance of Proxy
        amountInMax = _getBalance(tokenIn, amountInMax);

        // Approve token
        IERC20(tokenIn).safeApprove(UNISWAPV2_ROUTER, amountInMax);

        try
            router.swapTokensForExactTokens(
                amountOut,
                amountInMax,
                path,
                address(this),
                now + 1
            )
        returns (uint256[] memory amounts) {
            amount = amounts[0];
        } catch Error(string memory reason) {
            _revertMsg("swapTokensForExactTokens", reason);
        } catch {
            _revertMsg("swapTokensForExactTokens");
        }

        // Approve token 0
        IERC20(tokenIn).safeApprove(UNISWAPV2_ROUTER, 0);

        _updateToken(tokenOut);
    }
}
