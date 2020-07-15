pragma solidity ^0.5.0;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "../HandlerBase.sol";
import "./ICurveSwap.sol";
import "./IOneSplit.sol";


contract HCurve is HandlerBase {
    using SafeERC20 for IERC20;

    address constant ONE_SPLIT = 0xC586BeF4a0992C495Cf22e1aeEE4E446CECDee0E;

    // Curve fixed input used for susd, ren and sbtc pools
    function exchange(
        address swap,
        int128 i,
        int128 j,
        uint256 dx,
        uint256 minDy
    ) external payable {
        ICurveSwap curveSwap = ICurveSwap(swap);
        IERC20(curveSwap.coins(i)).safeApprove(address(curveSwap), dx);
        curveSwap.exchange(i, j, dx, minDy);
        IERC20(curveSwap.coins(i)).safeApprove(address(curveSwap), 0);

        _updateToken(curveSwap.coins(j));
    }

    // Curve fixed input used for compound, y, busd and pax pools
    function exchangeUnderlying(
        address swap,
        int128 i,
        int128 j,
        uint256 dx,
        uint256 minDy
    ) external payable {
        ICurveSwap curveSwap = ICurveSwap(swap);
        IERC20(curveSwap.underlying_coins(i)).safeApprove(
            address(curveSwap),
            dx
        );
        curveSwap.exchange_underlying(i, j, dx, minDy);
        IERC20(curveSwap.underlying_coins(i)).safeApprove(
            address(curveSwap),
            0
        );

        _updateToken(curveSwap.underlying_coins(j));
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
}
