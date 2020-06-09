pragma solidity ^0.5.0;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "../HandlerBase.sol";
import "./libraries/UniswapV2Library.sol";
import "./IUniswapV2Router01.sol";


contract HUniswapV2 is HandlerBase {
    using SafeERC20 for IERC20;

    address constant UNISWAPV2_ROUTER = 0xf164fC0Ec4E93095b804a4795bBe1e041497b92a;

    function addLiquidityETH(
        uint256 value,
        address token,
        uint256 amountTokenDesired,
        uint256 amountTokenMin,
        uint256 amountETHMin
    ) external payable {
        // Get uniswapV2 router
        IUniswapV2Router01 router = _getRouter();

        // Approve token
        IERC20(token).safeApprove(UNISWAPV2_ROUTER, amountTokenDesired);

        // Add liquidity ETH
        router.addLiquidityETH.value(value)(
            token,
            amountTokenDesired,
            amountTokenMin,
            amountETHMin,
            msg.sender,
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

    function _getRouter() internal pure returns (IUniswapV2Router01 router) {
        router = IUniswapV2Router01(UNISWAPV2_ROUTER);
    }
}
