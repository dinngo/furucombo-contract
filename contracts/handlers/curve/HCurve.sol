pragma solidity ^0.6.0;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "../HandlerBase.sol";
import "./ICurveHandler.sol";

contract HCurve is HandlerBase {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    function getContractName() public pure override returns (string memory) {
        return "HCurve";
    }

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
        uint256 minDy,
        bool isUint256, // indicate type of i and j
        bool useEth // indicate in and out token is ether instead of weth
    ) external payable returns (uint256) {
        return
            _exchangeInternal(
                handler,
                tokenI,
                tokenJ,
                i,
                j,
                dx,
                minDy,
                isUint256,
                useEth,
                false // useUnderlying
            );
    }

    // Curve fixed input exchange underlying
    function exchangeUnderlying(
        address handler,
        address tokenI,
        address tokenJ,
        int128 i,
        int128 j,
        uint256 dx,
        uint256 minDy,
        bool isUint256, // indicate type of i and j
        bool useEth // indicate in and out token is ether instead of weth
    ) external payable returns (uint256) {
        return
            _exchangeInternal(
                handler,
                tokenI,
                tokenJ,
                i,
                j,
                dx,
                minDy,
                isUint256,
                useEth,
                true // useUnderlying
            );
    }

    // Curve fixed input exchange supports eth and token
    function _exchangeInternal(
        address handler,
        address tokenI,
        address tokenJ,
        int128 i,
        int128 j,
        uint256 dx,
        uint256 minDy,
        bool isUint256,
        bool useEth,
        bool useUnderlying
    ) internal returns (uint256) {
        dx = _getBalance(tokenI, dx);
        uint256 beforeDy = _getBalance(tokenJ, uint256(-1));

        // Approve erc20 token or set eth amount
        uint256 ethAmount = 0;
        if (tokenI != ETH_ADDRESS) {
            _tokenApprove(tokenI, handler, dx);
        } else {
            ethAmount = dx;
        }

        if (useUnderlying) {
            if (isUint256 && useEth) {
                _exchangeUnderlyingUint256Ether(
                    handler,
                    ethAmount,
                    uint256(i),
                    uint256(j),
                    dx,
                    minDy
                );
            } else if (isUint256 && !useEth) {
                _exchangeUnderlyingUint256(
                    handler,
                    ethAmount,
                    uint256(i),
                    uint256(j),
                    dx,
                    minDy
                );
            } else {
                _exchangeUnderlying(handler, ethAmount, i, j, dx, minDy);
            }
        } else {
            if (isUint256 && useEth) {
                _exchangeUint256Ether(
                    handler,
                    ethAmount,
                    uint256(i),
                    uint256(j),
                    dx,
                    minDy
                );
            } else if (isUint256 && !useEth) {
                _exchangeUint256(
                    handler,
                    ethAmount,
                    uint256(i),
                    uint256(j),
                    dx,
                    minDy
                );
            } else {
                _exchange(handler, ethAmount, i, j, dx, minDy);
            }
        }

        uint256 afterDy = _getBalance(tokenJ, uint256(-1));
        if (afterDy <= beforeDy) {
            _revertMsg("exchangeInternal: afterDy <= beforeDy");
        }

        if (tokenJ != ETH_ADDRESS) _updateToken(tokenJ);
        return afterDy.sub(beforeDy);
    }

    function _exchange(
        address handler,
        uint256 ethAmount,
        int128 i,
        int128 j,
        uint256 dx,
        uint256 minDy
    ) internal {
        try
            ICurveHandler(handler).exchange{value: ethAmount}(i, j, dx, minDy)
        {} catch Error(string memory reason) {
            _revertMsg("_exchange", reason);
        } catch {
            _revertMsg("_exchange");
        }
    }

    function _exchangeUint256(
        address handler,
        uint256 ethAmount,
        uint256 i,
        uint256 j,
        uint256 dx,
        uint256 minDy
    ) internal {
        try
            ICurveHandler(handler).exchange{value: ethAmount}(i, j, dx, minDy)
        {} catch Error(string memory reason) {
            _revertMsg("_exchangeUint256", reason);
        } catch {
            _revertMsg("_exchangeUint256");
        }
    }

    function _exchangeUint256Ether(
        address handler,
        uint256 ethAmount,
        uint256 i,
        uint256 j,
        uint256 dx,
        uint256 minDy
    ) internal {
        try
            ICurveHandler(handler).exchange{value: ethAmount}(
                i,
                j,
                dx,
                minDy,
                true // use_eth
            )
        {} catch Error(string memory reason) {
            _revertMsg("_exchangeUint256Ether", reason);
        } catch {
            _revertMsg("_exchangeUint256Ether");
        }
    }

    function _exchangeUnderlying(
        address handler,
        uint256 ethAmount,
        int128 i,
        int128 j,
        uint256 dx,
        uint256 minDy
    ) internal {
        try
            ICurveHandler(handler).exchange_underlying{value: ethAmount}(
                i,
                j,
                dx,
                minDy
            )
        {} catch Error(string memory reason) {
            _revertMsg("_exchangeUnderlying", reason);
        } catch {
            _revertMsg("_exchangeUnderlying");
        }
    }

    function _exchangeUnderlyingUint256(
        address handler,
        uint256 ethAmount,
        uint256 i,
        uint256 j,
        uint256 dx,
        uint256 minDy
    ) internal {
        try
            ICurveHandler(handler).exchange_underlying{value: ethAmount}(
                i,
                j,
                dx,
                minDy
            )
        {} catch Error(string memory reason) {
            _revertMsg("_exchangeUnderlyingUint256", reason);
        } catch {
            _revertMsg("_exchangeUnderlyingUint256");
        }
    }

    function _exchangeUnderlyingUint256Ether(
        address handler,
        uint256 ethAmount,
        uint256 i,
        uint256 j,
        uint256 dx,
        uint256 minDy
    ) internal {
        try
            ICurveHandler(handler).exchange_underlying{value: ethAmount}(
                i,
                j,
                dx,
                minDy,
                true // use_eth
            )
        {} catch Error(string memory reason) {
            _revertMsg("_exchangeUnderlyingUint256Ether", reason);
        } catch {
            _revertMsg("_exchangeUnderlyingUint256Ether");
        }
    }

    // Curve add liquidity
    function addLiquidity(
        address handler,
        address pool,
        address[] calldata tokens,
        uint256[] calldata amounts,
        uint256 minMintAmount
    ) external payable returns (uint256) {
        return
            _addLiquidityInternal(
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
        uint256[] calldata amounts,
        uint256 minMintAmount
    ) external payable returns (uint256) {
        return
            _addLiquidityInternal(
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
    function _addLiquidityInternal(
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
            _tokenApprove(tokens[i], address(curveHandler), amounts[i]);
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
                    _revertMsg("_addLiquidityInternal: use underlying", reason);
                } catch {
                    _revertMsg("_addLiquidityInternal: use underlying");
                }
            } else {
                try
                    curveHandler.add_liquidity{value: ethAmount}(
                        amts,
                        minMintAmount
                    )
                {} catch Error(string memory reason) {
                    _revertMsg("_addLiquidityInternal", reason);
                } catch {
                    _revertMsg("_addLiquidityInternal");
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
                    _revertMsg("_addLiquidityInternal: use underlying", reason);
                } catch {
                    _revertMsg("_addLiquidityInternal: use underlying");
                }
            } else {
                try
                    curveHandler.add_liquidity{value: ethAmount}(
                        amts,
                        minMintAmount
                    )
                {} catch Error(string memory reason) {
                    _revertMsg("_addLiquidityInternal", reason);
                } catch {
                    _revertMsg("_addLiquidityInternal");
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
                    _revertMsg("_addLiquidityInternal: use underlying", reason);
                } catch {
                    _revertMsg("_addLiquidityInternal: use underlying");
                }
            } else {
                try
                    curveHandler.add_liquidity{value: ethAmount}(
                        amts,
                        minMintAmount
                    )
                {} catch Error(string memory reason) {
                    _revertMsg("_addLiquidityInternal", reason);
                } catch {
                    _revertMsg("_addLiquidityInternal");
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
                    _revertMsg("_addLiquidityInternal: use underlying", reason);
                } catch {
                    _revertMsg("_addLiquidityInternal: use underlying");
                }
            } else {
                try
                    curveHandler.add_liquidity{value: ethAmount}(
                        amts,
                        minMintAmount
                    )
                {} catch Error(string memory reason) {
                    _revertMsg("_addLiquidityInternal", reason);
                } catch {
                    _revertMsg("_addLiquidityInternal");
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
                    _revertMsg("_addLiquidityInternal: use underlying", reason);
                } catch {
                    _revertMsg("_addLiquidityInternal: use underlying");
                }
            } else {
                try
                    curveHandler.add_liquidity{value: ethAmount}(
                        amts,
                        minMintAmount
                    )
                {} catch Error(string memory reason) {
                    _revertMsg("_addLiquidityInternal", reason);
                } catch {
                    _revertMsg("_addLiquidityInternal");
                }
            }
        } else {
            _revertMsg("_addLiquidityInternal", "invalid amount array size");
        }

        uint256 afterPoolBalance = IERC20(pool).balanceOf(address(this));
        if (afterPoolBalance <= beforePoolBalance) {
            _revertMsg("_addLiquidityInternal: after <= before");
        }

        // Update post process
        _updateToken(address(pool));
        return afterPoolBalance.sub(beforePoolBalance);
    }

    // Curve remove liquidity one coin
    function removeLiquidityOneCoin(
        address handler,
        address pool,
        address tokenI,
        uint256 poolAmount,
        int128 i,
        uint256 minAmount,
        bool isUint256 // indicate type of i
    ) external payable returns (uint256) {
        return
            _removeLiquidityOneCoinInternal(
                handler,
                pool,
                tokenI,
                poolAmount,
                i,
                minAmount,
                isUint256,
                false // useUnderlying
            );
    }

    // Curve remove liquidity one coin underlying
    function removeLiquidityOneCoinUnderlying(
        address handler,
        address pool,
        address tokenI,
        uint256 poolAmount,
        int128 i,
        uint256 minAmount,
        bool isUint256 // indicate type of i
    ) external payable returns (uint256) {
        return
            _removeLiquidityOneCoinInternal(
                handler,
                pool,
                tokenI,
                poolAmount,
                i,
                minAmount,
                isUint256,
                true // useUnderlying
            );
    }

    // Curve remove liquidity one coin supports eth and token
    function _removeLiquidityOneCoinInternal(
        address handler,
        address pool,
        address tokenI,
        uint256 poolAmount,
        int128 i,
        uint256 minAmount,
        bool isUint256, // indicate type of i
        bool useUnderlying
    ) internal returns (uint256) {
        ICurveHandler curveHandler = ICurveHandler(handler);
        uint256 beforeTokenIBalance = _getBalance(tokenI, uint256(-1));
        poolAmount = _getBalance(pool, poolAmount);
        _tokenApprove(pool, address(curveHandler), poolAmount);
        if (useUnderlying) {
            if (isUint256) {
                try
                    curveHandler.remove_liquidity_one_coin(
                        poolAmount,
                        uint256(i),
                        minAmount,
                        useUnderlying
                    )
                {} catch Error(string memory reason) {
                    _revertMsg(
                        "_removeLiquidityOneCoinInternal: use underlying and is uint256",
                        reason
                    );
                } catch {
                    _revertMsg(
                        "_removeLiquidityOneCoinInternal: use underlying and is uint256"
                    );
                }
            } else {
                try
                    curveHandler.remove_liquidity_one_coin(
                        poolAmount,
                        i,
                        minAmount,
                        useUnderlying
                    )
                {} catch Error(string memory reason) {
                    _revertMsg(
                        "_removeLiquidityOneCoinInternal: use underlying",
                        reason
                    );
                } catch {
                    _revertMsg(
                        "_removeLiquidityOneCoinInternal: use underlying"
                    );
                }
            }
        } else {
            if (isUint256) {
                try
                    curveHandler.remove_liquidity_one_coin(
                        poolAmount,
                        uint256(i),
                        minAmount
                    )
                {} catch Error(string memory reason) {
                    _revertMsg(
                        "_removeLiquidityOneCoinInternal: is uint256",
                        reason
                    );
                } catch {
                    _revertMsg("_removeLiquidityOneCoinInternal: is uint256");
                }
            } else {
                try
                    curveHandler.remove_liquidity_one_coin(
                        poolAmount,
                        i,
                        minAmount
                    )
                {} catch Error(string memory reason) {
                    _revertMsg("_removeLiquidityOneCoinInternal", reason);
                } catch {
                    _revertMsg("_removeLiquidityOneCoinInternal");
                }
            }
        }
        // Some curve non-underlying pools like 3pool won't consume pool token
        // allowance since pool token was issued by curve swap contract that
        // don't need to call transferFrom().
        IERC20(pool).safeApprove(address(curveHandler), 0);
        uint256 afterTokenIBalance = _getBalance(tokenI, uint256(-1));
        if (afterTokenIBalance <= beforeTokenIBalance) {
            _revertMsg("_removeLiquidityOneCoinInternal: after <= before");
        }

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
        _tokenApprove(pool, address(curveHandler), poolAmount);
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
        uint256 afterTokenIBalance = IERC20(tokenI).balanceOf(address(this));
        if (afterTokenIBalance <= beforeTokenIBalance) {
            _revertMsg("removeLiquidityOneCoinDust: after <= before");
        }

        // Update post process
        _updateToken(tokenI);
        return afterTokenIBalance.sub(beforeTokenIBalance);
    }
}
