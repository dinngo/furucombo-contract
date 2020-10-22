pragma solidity ^0.6.0;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "../HandlerBase.sol";
import "./ICurveHandler.sol";
import "./IOneSplit.sol";

contract HCurve is HandlerBase {
    using SafeERC20 for IERC20;

    // prettier-ignore
    address public constant ONE_SPLIT = 0xC586BeF4a0992C495Cf22e1aeEE4E446CECDee0E;

    // Curve fixed input exchange
    function exchange(
        address handler,
        address tokenI,
        address tokenJ,
        int128 i,
        int128 j,
        uint256 dx,
        uint256 minDy
    ) external payable {
        ICurveHandler curveHandler = ICurveHandler(handler);
        IERC20(tokenI).safeApprove(address(curveHandler), dx);
        curveHandler.exchange(i, j, dx, minDy);
        IERC20(tokenI).safeApprove(address(curveHandler), 0);

        _updateToken(tokenJ);
    }

    // Curve fixed input underlying exchange
    function exchangeUnderlying(
        address handler,
        address tokenI,
        address tokenJ,
        int128 i,
        int128 j,
        uint256 dx,
        uint256 minDy
    ) external payable {
        ICurveHandler curveHandler = ICurveHandler(handler);
        IERC20(tokenI).safeApprove(address(curveHandler), dx);
        curveHandler.exchange_underlying(i, j, dx, minDy);
        IERC20(tokenI).safeApprove(address(curveHandler), 0);

        _updateToken(tokenJ);
    }

    // OneSplit fixed input used for Curve swap
    function swap(
        address fromToken,
        address toToken,
        uint256 amount,
        uint256 minReturn,
        uint256[] calldata distribution,
        uint256 featureFlags
    ) external payable {
        IOneSplit oneSplit = IOneSplit(ONE_SPLIT);
        IERC20(fromToken).safeApprove(address(oneSplit), amount);
        oneSplit.swap(
            fromToken,
            toToken,
            amount,
            minReturn,
            distribution,
            featureFlags
        );
        IERC20(fromToken).safeApprove(address(oneSplit), 0);

        _updateToken(toToken);
    }

    // Curve add liquidity need exact array size for each pool
    function addLiquidity(
        address handler,
        address pool,
        address[] calldata tokens,
        uint256[] calldata amounts,
        uint256 minMintAmount
    ) external payable {
        ICurveHandler curveHandler = ICurveHandler(handler);

        // Approve non-zero amount erc20 token
        for (uint256 i = 0; i < amounts.length; i++) {
            if (amounts[i] == 0) continue;
            IERC20(tokens[i]).safeApprove(address(curveHandler), amounts[i]);
        }

        // Execute add_liquidity according to amount array size
        if (amounts.length == 2) {
            uint256[2] memory amts = [amounts[0], amounts[1]];
            curveHandler.add_liquidity(amts, minMintAmount);
        } else if (amounts.length == 3) {
            uint256[3] memory amts = [amounts[0], amounts[1], amounts[2]];
            curveHandler.add_liquidity(amts, minMintAmount);
        } else if (amounts.length == 4) {
            uint256[4] memory amts = [
                amounts[0],
                amounts[1],
                amounts[2],
                amounts[3]
            ];
            curveHandler.add_liquidity(amts, minMintAmount);
        } else if (amounts.length == 5) {
            uint256[5] memory amts = [
                amounts[0],
                amounts[1],
                amounts[2],
                amounts[3],
                amounts[4]
            ];
            curveHandler.add_liquidity(amts, minMintAmount);
        } else if (amounts.length == 6) {
            uint256[6] memory amts = [
                amounts[0],
                amounts[1],
                amounts[2],
                amounts[3],
                amounts[4],
                amounts[5]
            ];
            curveHandler.add_liquidity(amts, minMintAmount);
        } else {
            revert("invalid amount array size");
        }

        // Reset zero amount for approval
        for (uint256 i = 0; i < amounts.length; i++) {
            if (amounts[i] == 0) continue;
            IERC20(tokens[i]).safeApprove(address(curveHandler), 0);
        }

        // Update post process
        _updateToken(address(pool));
    }

    // Curve remove liquidity one coin
    function removeLiquidityOneCoin(
        address handler,
        address pool,
        address tokenI,
        uint256 tokenAmount,
        int128 i,
        uint256 minAmount
    ) external payable {
        ICurveHandler curveHandler = ICurveHandler(handler);
        IERC20(pool).safeApprove(address(curveHandler), tokenAmount);
        curveHandler.remove_liquidity_one_coin(tokenAmount, i, minAmount);
        IERC20(pool).safeApprove(address(curveHandler), 0);

        // Update post process
        _updateToken(tokenI);
    }

    // Curve remove liquidity one coin and donate dust
    function removeLiquidityOneCoinDust(
        address handler,
        address pool,
        address tokenI,
        uint256 tokenAmount,
        int128 i,
        uint256 minAmount
    ) external payable {
        ICurveHandler curveHandler = ICurveHandler(handler);
        IERC20(pool).safeApprove(address(curveHandler), tokenAmount);
        curveHandler.remove_liquidity_one_coin(
            tokenAmount,
            i,
            minAmount,
            true // donate_dust
        );
        IERC20(pool).safeApprove(address(curveHandler), 0);

        // Update post process
        _updateToken(tokenI);
    }
}
