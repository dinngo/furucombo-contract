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
    // prettier-ignore
    address public constant ETH_ADDRESS = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

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
        return
            exchangeInternal(handler, tokenI, tokenJ, i, j, dx, minDy, false);
    }

    // Curve fixed input exchange underlying
    function exchangeUnderlying(
        address handler,
        address tokenI,
        address tokenJ,
        int128 i,
        int128 j,
        uint256 dx,
        uint256 minDy
    ) external payable returns (uint256) {
        return exchangeInternal(handler, tokenI, tokenJ, i, j, dx, minDy, true);
    }

    // Curve fixed input exchange supports eth and token
    function exchangeInternal(
        address handler,
        address tokenI,
        address tokenJ,
        int128 i,
        int128 j,
        uint256 dx,
        uint256 minDy,
        bool useUnderlying
    ) internal returns (uint256) {
        ICurveHandler curveHandler = ICurveHandler(handler);
        dx = _getBalance(tokenI, dx);

        uint256 beforeDy = _getBalance(tokenJ, uint256(-1));
        if (tokenI == ETH_ADDRESS) {
            if (useUnderlying) {
                try
                    curveHandler.exchange_underlying{value: dx}(i, j, dx, minDy)
                {} catch Error(string memory reason) {
                    _revertMsg("exchangeInternal", reason);
                } catch {
                    _revertMsg("exchangeInternal");
                }
            } else {
                try
                    curveHandler.exchange{value: dx}(i, j, dx, minDy)
                {} catch Error(string memory reason) {
                    _revertMsg("exchangeInternal", reason);
                } catch {
                    _revertMsg("exchangeInternal");
                }
            }
        } else {
            IERC20(tokenI).safeApprove(address(curveHandler), dx);
            if (useUnderlying) {
                try
                    curveHandler.exchange_underlying(i, j, dx, minDy)
                {} catch Error(string memory reason) {
                    _revertMsg("exchangeInternal", reason);
                } catch {
                    _revertMsg("exchangeInternal");
                }
            } else {
                try curveHandler.exchange(i, j, dx, minDy) {} catch Error(
                    string memory reason
                ) {
                    _revertMsg("exchangeInternal", reason);
                } catch {
                    _revertMsg("exchangeInternal");
                }
            }
            IERC20(tokenI).safeApprove(address(curveHandler), 0);
        }
        uint256 afterDy = _getBalance(tokenJ, uint256(-1));

        if (tokenJ != ETH_ADDRESS) _updateToken(tokenJ);
        return afterDy.sub(beforeDy);
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

    // Curve add liquidity
    function addLiquidity(
        address handler,
        address pool,
        address[] calldata tokens,
        uint256[] memory amounts,
        uint256 minMintAmount
    ) external payable returns (uint256) {
        return
            addLiquidityInternal(
                handler,
                pool,
                tokens,
                amounts,
                minMintAmount,
                false
            );
    }

    // Curve add liquidity underlying
    function addLiquidityUnderlying(
        address handler,
        address pool,
        address[] calldata tokens,
        uint256[] memory amounts,
        uint256 minMintAmount
    ) external payable returns (uint256) {
        return
            addLiquidityInternal(
                handler,
                pool,
                tokens,
                amounts,
                minMintAmount,
                true
            );
    }

    // Curve add liquidity need exact array size for each pool which supports
    // eth and token
    function addLiquidityInternal(
        address handler,
        address pool,
        address[] calldata tokens,
        uint256[] memory amounts,
        uint256 minMintAmount,
        bool useUnderlying
    ) internal returns (uint256) {
        ICurveHandler curveHandler = ICurveHandler(handler);
        uint256 beforePoolBalance = IERC20(pool).balanceOf(address(this));

        // Approve non-zero amount erc20 token and set eth amount
        uint256 ethAmount = 0;
        for (uint256 i = 0; i < amounts.length; i++) {
            if (amounts[i] == 0) continue;
            if (tokens[i] == ETH_ADDRESS) {
                ethAmount = amounts[i];
                continue;
            }
            amounts[i] = _getBalance(tokens[i], amounts[i]);
            IERC20(tokens[i]).safeApprove(address(curveHandler), amounts[i]);
        }

        // Execute add_liquidity according to amount array size
        if (amounts.length == 2) {
            uint256[2] memory amts = [amounts[0], amounts[1]];
            if (useUnderlying) {
                try
                    curveHandler.add_liquidity{value: ethAmount}(
                        amts,
                        minMintAmount,
                        useUnderlying
                    )
                {} catch Error(string memory reason) {
                    _revertMsg("addLiquidityInternal", reason);
                } catch {
                    _revertMsg("addLiquidityInternal");
                }
            } else {
                try
                    curveHandler.add_liquidity{value: ethAmount}(
                        amts,
                        minMintAmount
                    )
                {} catch Error(string memory reason) {
                    _revertMsg("addLiquidityInternal", reason);
                } catch {
                    _revertMsg("addLiquidityInternal");
                }
            }
        } else if (amounts.length == 3) {
            uint256[3] memory amts = [amounts[0], amounts[1], amounts[2]];
            if (useUnderlying) {
                try
                    curveHandler.add_liquidity{value: ethAmount}(
                        amts,
                        minMintAmount,
                        useUnderlying
                    )
                {} catch Error(string memory reason) {
                    _revertMsg("addLiquidityInternal", reason);
                } catch {
                    _revertMsg("addLiquidityInternal");
                }
            } else {
                try
                    curveHandler.add_liquidity{value: ethAmount}(
                        amts,
                        minMintAmount
                    )
                {} catch Error(string memory reason) {
                    _revertMsg("addLiquidityInternal", reason);
                } catch {
                    _revertMsg("addLiquidityInternal");
                }
            }
        } else if (amounts.length == 4) {
            uint256[4] memory amts =
                [amounts[0], amounts[1], amounts[2], amounts[3]];
            if (useUnderlying) {
                try
                    curveHandler.add_liquidity{value: ethAmount}(
                        amts,
                        minMintAmount,
                        useUnderlying
                    )
                {} catch Error(string memory reason) {
                    _revertMsg("addLiquidityInternal", reason);
                } catch {
                    _revertMsg("addLiquidityInternal");
                }
            } else {
                try
                    curveHandler.add_liquidity{value: ethAmount}(
                        amts,
                        minMintAmount
                    )
                {} catch Error(string memory reason) {
                    _revertMsg("addLiquidityInternal", reason);
                } catch {
                    _revertMsg("addLiquidityInternal");
                }
            }
        } else if (amounts.length == 5) {
            uint256[5] memory amts =
                [amounts[0], amounts[1], amounts[2], amounts[3], amounts[4]];
            if (useUnderlying) {
                try
                    curveHandler.add_liquidity{value: ethAmount}(
                        amts,
                        minMintAmount,
                        useUnderlying
                    )
                {} catch Error(string memory reason) {
                    _revertMsg("addLiquidityInternal", reason);
                } catch {
                    _revertMsg("addLiquidityInternal");
                }
            } else {
                try
                    curveHandler.add_liquidity{value: ethAmount}(
                        amts,
                        minMintAmount
                    )
                {} catch Error(string memory reason) {
                    _revertMsg("addLiquidityInternal", reason);
                } catch {
                    _revertMsg("addLiquidityInternal");
                }
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
            if (useUnderlying) {
                try
                    curveHandler.add_liquidity{value: ethAmount}(
                        amts,
                        minMintAmount,
                        useUnderlying
                    )
                {} catch Error(string memory reason) {
                    _revertMsg("addLiquidityInternal", reason);
                } catch {
                    _revertMsg("addLiquidityInternal");
                }
            } else {
                try
                    curveHandler.add_liquidity{value: ethAmount}(
                        amts,
                        minMintAmount
                    )
                {} catch Error(string memory reason) {
                    _revertMsg("addLiquidityInternal", reason);
                } catch {
                    _revertMsg("addLiquidityInternal");
                }
            }
        } else {
            _revertMsg("addLiquidityInternal", "invalid amount array size");
        }

        // Reset zero amount for approval
        for (uint256 i = 0; i < amounts.length; i++) {
            if (amounts[i] == 0) continue;
            if (tokens[i] == ETH_ADDRESS) continue;
            IERC20(tokens[i]).safeApprove(address(curveHandler), 0);
        }

        uint256 afterPoolBalance = IERC20(pool).balanceOf(address(this));

        // Update post process
        _updateToken(address(pool));
        return afterPoolBalance.sub(beforePoolBalance);
    }

    // Curve remove liquidity
    function removeLiquidityOneCoin(
        address handler,
        address pool,
        address tokenI,
        uint256 poolAmount,
        int128 i,
        uint256 minAmount
    ) external payable returns (uint256) {
        return
            removeLiquidityOneCoinInternal(
                handler,
                pool,
                tokenI,
                poolAmount,
                i,
                minAmount,
                false
            );
    }

    // Curve remove liquidity one coin underlying
    function removeLiquidityOneCoinUnderlying(
        address handler,
        address pool,
        address tokenI,
        uint256 poolAmount,
        int128 i,
        uint256 minAmount
    ) external payable returns (uint256) {
        return
            removeLiquidityOneCoinInternal(
                handler,
                pool,
                tokenI,
                poolAmount,
                i,
                minAmount,
                true
            );
    }

    // Curve remove liquidity one coin supports eth and token
    function removeLiquidityOneCoinInternal(
        address handler,
        address pool,
        address tokenI,
        uint256 poolAmount,
        int128 i,
        uint256 minAmount,
        bool useUnderlying
    ) internal returns (uint256) {
        ICurveHandler curveHandler = ICurveHandler(handler);
        uint256 beforeTokenIBalance = _getBalance(tokenI, uint256(-1));
        poolAmount = _getBalance(pool, poolAmount);
        IERC20(pool).safeApprove(address(curveHandler), poolAmount);
        if (useUnderlying) {
            try
                curveHandler.remove_liquidity_one_coin(
                    poolAmount,
                    i,
                    minAmount,
                    useUnderlying
                )
            {} catch Error(string memory reason) {
                _revertMsg("removeLiquidityOneCoinInternal", reason);
            } catch {
                _revertMsg("removeLiquidityOneCoinInternal");
            }
        } else {
            try
                curveHandler.remove_liquidity_one_coin(poolAmount, i, minAmount)
            {} catch Error(string memory reason) {
                _revertMsg("removeLiquidityOneCoinInternal", reason);
            } catch {
                _revertMsg("removeLiquidityOneCoinInternal");
            }
        }
        IERC20(pool).safeApprove(address(curveHandler), 0);
        uint256 afterTokenIBalance = _getBalance(tokenI, uint256(-1));

        // Update post process
        if (tokenI != ETH_ADDRESS) _updateToken(tokenI);
        return afterTokenIBalance.sub(beforeTokenIBalance);
    }

    // Curve remove liquidity one coin and donate dust
    function removeLiquidityOneCoinDust(
        address handler,
        address pool,
        address tokenI,
        uint256 poolAmount,
        int128 i,
        uint256 minAmount
    ) external payable returns (uint256) {
        ICurveHandler curveHandler = ICurveHandler(handler);
        uint256 beforeTokenIBalance = IERC20(tokenI).balanceOf(address(this));
        poolAmount = _getBalance(pool, poolAmount);
        IERC20(pool).safeApprove(address(curveHandler), poolAmount);
        try
            curveHandler.remove_liquidity_one_coin(
                poolAmount,
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
