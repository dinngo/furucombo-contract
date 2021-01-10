pragma solidity ^0.6.0;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "../HandlerBase.sol";
import "./ICurveHandler.sol";
import "./IOneSplit.sol";

contract HCurve is HandlerBase {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    function getContractName() public pure override returns (string memory) {
        return "HCurve";
    }

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
    ) external payable returns (uint256) {
        ICurveHandler curveHandler = ICurveHandler(handler);
        uint256 beforeTokenJBalance = IERC20(tokenJ).balanceOf(address(this));
        // if amount == uint256(-1) return balance of Proxy
        dx = _getBalance(tokenI, dx);
        IERC20(tokenI).safeApprove(address(curveHandler), dx);
        try curveHandler.exchange(i, j, dx, minDy) {} catch Error(
            string memory reason
        ) {
            _revertMsg("exchange", reason);
        } catch {
            _revertMsg("exchange");
        }
        IERC20(tokenI).safeApprove(address(curveHandler), 0);
        uint256 afterTokenJBalance = IERC20(tokenJ).balanceOf(address(this));

        _updateToken(tokenJ);
        return afterTokenJBalance.sub(beforeTokenJBalance);
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
    ) external payable returns (uint256) {
        ICurveHandler curveHandler = ICurveHandler(handler);
        uint256 beforeTokenJBalance = IERC20(tokenJ).balanceOf(address(this));
        // if amount == uint256(-1) return balance of Proxy
        dx = _getBalance(tokenI, dx);
        IERC20(tokenI).safeApprove(address(curveHandler), dx);
        try curveHandler.exchange_underlying(i, j, dx, minDy) {} catch Error(
            string memory reason
        ) {
            _revertMsg("exchangeUnderlying", reason);
        } catch {
            _revertMsg("exchangeUnderlying");
        }
        IERC20(tokenI).safeApprove(address(curveHandler), 0);
        uint256 afterTokenJBalance = IERC20(tokenJ).balanceOf(address(this));

        _updateToken(tokenJ);
        return afterTokenJBalance.sub(beforeTokenJBalance);
    }

    // OneSplit fixed input used for Curve swap
    function swap(
        address fromToken,
        address toToken,
        uint256 amount,
        uint256 minReturn,
        uint256[] calldata distribution,
        uint256 featureFlags
    ) external payable returns (uint256) {
        IOneSplit oneSplit = IOneSplit(ONE_SPLIT);
        uint256 beforeToTokenBalance = IERC20(toToken).balanceOf(address(this));
        // if amount == uint256(-1) return balance of Proxy
        amount = _getBalance(fromToken, amount);
        IERC20(fromToken).safeApprove(address(oneSplit), amount);
        try
            oneSplit.swap(
                fromToken,
                toToken,
                amount,
                minReturn,
                distribution,
                featureFlags
            )
        {} catch Error(string memory reason) {
            _revertMsg("swap", reason);
        } catch {
            _revertMsg("swap");
        }
        IERC20(fromToken).safeApprove(address(oneSplit), 0);
        uint256 afterToTokenBalance = IERC20(toToken).balanceOf(address(this));

        _updateToken(toToken);
        return afterToTokenBalance.sub(beforeToTokenBalance);
    }

    // Curve add liquidity need exact array size for each pool
    function addLiquidity(
        address handler,
        address pool,
        address[] calldata tokens,
        uint256[] memory amounts,
        uint256 minMintAmount
    ) external payable returns (uint256) {
        ICurveHandler curveHandler = ICurveHandler(handler);
        uint256 beforePoolBalance = IERC20(pool).balanceOf(address(this));

        // Approve non-zero amount erc20 token
        for (uint256 i = 0; i < amounts.length; i++) {
            if (amounts[i] == 0) continue;
            // if amount == uint256(-1) return balance of Proxy
            amounts[i] = _getBalance(tokens[i], amounts[i]);
            IERC20(tokens[i]).safeApprove(address(curveHandler), amounts[i]);
        }

        // Execute add_liquidity according to amount array size
        if (amounts.length == 2) {
            uint256[2] memory amts = [amounts[0], amounts[1]];
            try curveHandler.add_liquidity(amts, minMintAmount) {} catch Error(
                string memory reason
            ) {
                _revertMsg("addLiquidity", reason);
            } catch {
                _revertMsg("addLiquidity");
            }
        } else if (amounts.length == 3) {
            uint256[3] memory amts = [amounts[0], amounts[1], amounts[2]];
            try curveHandler.add_liquidity(amts, minMintAmount) {} catch Error(
                string memory reason
            ) {
                _revertMsg("addLiquidity", reason);
            } catch {
                _revertMsg("addLiquidity");
            }
        } else if (amounts.length == 4) {
            uint256[4] memory amts =
                [amounts[0], amounts[1], amounts[2], amounts[3]];
            try curveHandler.add_liquidity(amts, minMintAmount) {} catch Error(
                string memory reason
            ) {
                _revertMsg("addLiquidity", reason);
            } catch {
                _revertMsg("addLiquidity");
            }
        } else if (amounts.length == 5) {
            uint256[5] memory amts =
                [amounts[0], amounts[1], amounts[2], amounts[3], amounts[4]];
            try curveHandler.add_liquidity(amts, minMintAmount) {} catch Error(
                string memory reason
            ) {
                _revertMsg("addLiquidity", reason);
            } catch {
                _revertMsg("addLiquidity");
            }
        } else if (amounts.length == 6) {
            uint256[6] memory amts =
                [
                    amounts[0],
                    amounts[1],
                    amounts[2],
                    amounts[3],
                    amounts[4],
                    amounts[5]
                ];
            try curveHandler.add_liquidity(amts, minMintAmount) {} catch Error(
                string memory reason
            ) {
                _revertMsg("addLiquidity", reason);
            } catch {
                _revertMsg("addLiquidity");
            }
        } else {
            _revertMsg("addLiquidity", "invalid amount array size");
        }

        // Reset zero amount for approval
        for (uint256 i = 0; i < amounts.length; i++) {
            if (amounts[i] == 0) continue;
            IERC20(tokens[i]).safeApprove(address(curveHandler), 0);
        }

        uint256 afterPoolBalance = IERC20(pool).balanceOf(address(this));

        // Update post process
        _updateToken(address(pool));
        return afterPoolBalance.sub(beforePoolBalance);
    }

    // Curve remove liquidity one coin
    function removeLiquidityOneCoin(
        address handler,
        address pool,
        address tokenI,
        uint256 tokenAmount,
        int128 i,
        uint256 minAmount
    ) external payable returns (uint256) {
        ICurveHandler curveHandler = ICurveHandler(handler);
        uint256 beforeTokenIBalance = IERC20(tokenI).balanceOf(address(this));
        tokenAmount = _getBalance(pool, tokenAmount);
        IERC20(pool).safeApprove(address(curveHandler), tokenAmount);
        try
            curveHandler.remove_liquidity_one_coin(tokenAmount, i, minAmount)
        {} catch Error(string memory reason) {
            _revertMsg("removeLiquidityOneCoin", reason);
        } catch {
            _revertMsg("removeLiquidityOneCoin");
        }
        IERC20(pool).safeApprove(address(curveHandler), 0);
        uint256 afterTokenIBalance = IERC20(tokenI).balanceOf(address(this));

        // Update post process
        _updateToken(tokenI);
        return afterTokenIBalance.sub(beforeTokenIBalance);
    }

    // Curve remove liquidity one coin and donate dust
    function removeLiquidityOneCoinDust(
        address handler,
        address pool,
        address tokenI,
        uint256 tokenAmount,
        int128 i,
        uint256 minAmount
    ) external payable returns (uint256) {
        ICurveHandler curveHandler = ICurveHandler(handler);
        uint256 beforeTokenIBalance = IERC20(tokenI).balanceOf(address(this));
        tokenAmount = _getBalance(pool, tokenAmount);
        IERC20(pool).safeApprove(address(curveHandler), tokenAmount);
        try
            curveHandler.remove_liquidity_one_coin(
                tokenAmount,
                i,
                minAmount,
                true // donate_dust
            )
        {} catch Error(string memory reason) {
            _revertMsg("removeLiquidityOneCoinDust", reason);
        } catch {
            _revertMsg("removeLiquidityOneCoinDust");
        }
        IERC20(pool).safeApprove(address(curveHandler), 0);
        uint256 afterTokenIBalance = IERC20(tokenI).balanceOf(address(this));

        // Update post process
        _updateToken(tokenI);
        return afterTokenIBalance.sub(beforeTokenIBalance);
    }
}
