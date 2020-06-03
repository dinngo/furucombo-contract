pragma solidity ^0.5.0;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "../HandlerBase.sol";
import "./libraries/UniswapV2Library.sol";
import "./IUniswapV2Factory.sol";
import "./IUniswapV2Router01.sol";


contract HUniswapV2 is HandlerBase {
    using SafeERC20 for IERC20;

    address constant UNISWAPV2_ROUTER = 0xf164fc0ec4e93095b804a4795bbe1e041497b92a;
    // address constant UNISWAPV2_FACTORY = 0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f;
    address constant WETH = 0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2;

    function addLiquidityETH(
        uint256 value,
        address token,
        uint256 amountTokenDesired,
        uint256 amountTokenMin,
        uint256 amountETHMin,
        uint256 deadline
    ) external payable {
        // Get uniswapV2 router
        IUniswapV2Router01 router = _getRouter();

        // Approve token
        IERC20(token).safeApprove(
            address(UNISWAPV2_ROUTER),
            amountTokenDesired
        );

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
        IERC20(token).safeApprove(address(UNISWAPV2_ROUTER), 0);

        // Update involved token
        IUniswapV2Factory factory = router.factory();
        address pair = UniswapV2Library.pairFor(factory, token, WETH);
        _updateToken(pair);
    }

    function _getRouter() internal view returns (IUniswapV2Router01 router) {
        router = IUniswapV2Router01(UNISWAPV2_ROUTER);
    }
}
