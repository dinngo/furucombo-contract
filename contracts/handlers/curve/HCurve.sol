pragma solidity ^0.5.0;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "../HandlerBase.sol";
import "./ICurveSwap.sol";
import "./ICurveDeposit.sol";
import "./IOneSplit.sol";

contract HCurve is HandlerBase {
    using SafeERC20 for IERC20;

    // prettier-ignore
    address public constant ONE_SPLIT = 0xC586BeF4a0992C495Cf22e1aeEE4E446CECDee0E;

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

    // Curve add liquidity used for susd, ren and sbtc pools which don't use
    // underlying tokens.
    function addLiquidity(
        address swapAddress,
        address pool,
        uint256[] calldata amounts,
        uint256 minMintAmount
    ) external payable {
        ICurveSwap curveSwap = ICurveSwap(swapAddress);

        // Approve non-zero amount erc20 token
        for (uint256 i = 0; i < amounts.length; i++) {
            if (amounts[i] == 0) continue;
            IERC20(curveSwap.coins(int128(i))).safeApprove(
                address(curveSwap),
                amounts[i]
            );
        }

        // Execute add_liquidity according to amount array size
        if (amounts.length == 4) {
            uint256[4] memory amts = [
                amounts[0],
                amounts[1],
                amounts[2],
                amounts[3]
            ];
            curveSwap.add_liquidity(amts, minMintAmount);
        } else if (amounts.length == 3) {
            uint256[3] memory amts = [amounts[0], amounts[1], amounts[2]];
            curveSwap.add_liquidity(amts, minMintAmount);
        } else if (amounts.length == 2) {
            uint256[2] memory amts = [amounts[0], amounts[1]];
            curveSwap.add_liquidity(amts, minMintAmount);
        } else {
            revert("invalid amount array size");
        }

        // Reset zero amount for approval
        for (uint256 i = 0; i < amounts.length; i++) {
            if (amounts[i] == 0) continue;
            IERC20(curveSwap.coins(int128(i))).safeApprove(
                address(curveSwap),
                0
            );
        }

        // Update post process
        _updateToken(address(pool));
    }

    // Curve add liquidity used for compound, y, busd and pax pools using
    // zap which is wrapped contract called deposit.
    function addLiquidityZap(
        address deposit,
        uint256[] calldata uamounts,
        uint256 minMintAmount
    ) external payable {
        ICurveDeposit curveDeposit = ICurveDeposit(deposit);

        // Approve non-zero amount erc20 token
        for (uint256 i = 0; i < uamounts.length; i++) {
            if (uamounts[i] == 0) continue;
            IERC20(curveDeposit.underlying_coins(int128(i))).safeApprove(
                address(curveDeposit),
                uamounts[i]
            );
        }

        // Execute add_liquidity according to uamount array size
        if (uamounts.length == 4) {
            uint256[4] memory amts = [
                uamounts[0],
                uamounts[1],
                uamounts[2],
                uamounts[3]
            ];
            curveDeposit.add_liquidity(amts, minMintAmount);
        } else if (uamounts.length == 3) {
            uint256[3] memory amts = [uamounts[0], uamounts[1], uamounts[2]];
            curveDeposit.add_liquidity(amts, minMintAmount);
        } else if (uamounts.length == 2) {
            uint256[2] memory amts = [uamounts[0], uamounts[1]];
            curveDeposit.add_liquidity(amts, minMintAmount);
        } else {
            revert("invalid uamount array size");
        }

        // Reset zero amount for approval
        for (uint256 i = 0; i < uamounts.length; i++) {
            if (uamounts[i] == 0) continue;
            IERC20(curveDeposit.underlying_coins(int128(i))).safeApprove(
                address(curveDeposit),
                0
            );
        }

        // Update post process
        _updateToken(curveDeposit.token());
    }

    // Curve remove liquidity one coin used for ren and sbtc pools which don't
    // use underlying tokens.
    function removeLiquidityOneCoin(
        address swapAddress,
        address pool,
        uint256 tokenAmount,
        int128 i,
        uint256 minAmount
    ) external payable {
        ICurveSwap curveSwap = ICurveSwap(swapAddress);
        IERC20(pool).safeApprove(address(curveSwap), tokenAmount);
        curveSwap.remove_liquidity_one_coin(tokenAmount, i, minAmount);
        IERC20(pool).safeApprove(address(curveSwap), 0);

        // Update post process
        _updateToken(curveSwap.coins(i));
    }

    // Curve remove liquidity one coin used for compound, y, busd, pax and susd
    // pools using zap which is wrapped contract called deposit. Note that if we
    // use susd remove_liquidity_one_coin() it must be the one in deposit
    // instead of swap contract.
    function removeLiquidityOneCoinZap(
        address deposit,
        uint256 tokenAmount,
        int128 i,
        uint256 minUamount
    ) external payable {
        ICurveDeposit curveDeposit = ICurveDeposit(deposit);
        IERC20(curveDeposit.token()).safeApprove(
            address(curveDeposit),
            tokenAmount
        );
        curveDeposit.remove_liquidity_one_coin(
            tokenAmount,
            i,
            minUamount,
            true
        );
        IERC20(curveDeposit.token()).safeApprove(address(curveDeposit), 0);

        // Update post process
        _updateToken(curveDeposit.underlying_coins(i));
    }
}
