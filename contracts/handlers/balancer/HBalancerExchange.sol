pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import "./IExchangeProxy.sol";
import "../HandlerBase.sol";

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

contract HBalancerExchange is HandlerBase {
    using SafeERC20 for IERC20;

    // prettier-ignore
    address public constant EXCHANGE_PROXY = 0x3E66B66Fd1d0b02fDa6C811Da9E0547970DB2f21;
    // prettier-ignore
    address public constant ETH_ADDRESS = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    function getContractName() public pure override returns (string memory) {
        return "HBalancerExchange";
    }

    function batchSwapExactIn(
        IExchangeProxy.Swap[] calldata swaps,
        address tokenIn,
        address tokenOut,
        uint256 totalAmountIn,
        uint256 minTotalAmountOut
    ) external payable returns (uint256 totalAmountOut) {
        IExchangeProxy balancer = IExchangeProxy(EXCHANGE_PROXY);
        totalAmountIn = _getBalance(tokenIn, totalAmountIn);

        if (tokenIn == ETH_ADDRESS) {
            try
                balancer.batchSwapExactIn{value: totalAmountIn}(
                    swaps,
                    tokenIn,
                    tokenOut,
                    totalAmountIn,
                    minTotalAmountOut
                )
            returns (uint256 amount) {
                totalAmountOut = amount;
            } catch Error(string memory reason) {
                _revertMsg("batchSwapExactIn", reason);
            } catch {
                _revertMsg("batchSwapExactIn");
            }
        } else {
            IERC20(tokenIn).safeApprove(EXCHANGE_PROXY, totalAmountIn);
            try
                balancer.batchSwapExactIn(
                    swaps,
                    tokenIn,
                    tokenOut,
                    totalAmountIn,
                    minTotalAmountOut
                )
            returns (uint256 amount) {
                totalAmountOut = amount;
            } catch Error(string memory reason) {
                _revertMsg("batchSwapExactIn", reason);
            } catch {
                _revertMsg("batchSwapExactIn");
            }
            IERC20(tokenIn).safeApprove(EXCHANGE_PROXY, 0);
        }

        if (tokenOut != ETH_ADDRESS) _updateToken(tokenOut);
    }

    function batchSwapExactOut(
        IExchangeProxy.Swap[] calldata swaps,
        address tokenIn,
        address tokenOut,
        uint256 maxTotalAmountIn
    ) external payable returns (uint256 totalAmountIn) {
        IExchangeProxy balancer = IExchangeProxy(EXCHANGE_PROXY);

        if (tokenIn == ETH_ADDRESS) {
            try
                balancer.batchSwapExactOut{value: maxTotalAmountIn}(
                    swaps,
                    tokenIn,
                    tokenOut,
                    maxTotalAmountIn
                )
            returns (uint256 amount) {
                totalAmountIn = amount;
            } catch Error(string memory reason) {
                _revertMsg("batchSwapExactOut", reason);
            } catch {
                _revertMsg("batchSwapExactOut");
            }
        } else {
            IERC20(tokenIn).safeApprove(EXCHANGE_PROXY, maxTotalAmountIn);
            try
                balancer.batchSwapExactOut(
                    swaps,
                    tokenIn,
                    tokenOut,
                    maxTotalAmountIn
                )
            returns (uint256 amount) {
                totalAmountIn = amount;
            } catch Error(string memory reason) {
                _revertMsg("batchSwapExactOut", reason);
            } catch {
                _revertMsg("batchSwapExactOut");
            }
            IERC20(tokenIn).safeApprove(EXCHANGE_PROXY, 0);
        }

        if (tokenOut != ETH_ADDRESS) _updateToken(tokenOut);
    }

    function multihopBatchSwapExactIn(
        IExchangeProxy.Swap[][] calldata swapSequences,
        address tokenIn,
        address tokenOut,
        uint256 totalAmountIn,
        uint256 minTotalAmountOut
    ) external payable returns (uint256 totalAmountOut) {
        IExchangeProxy balancer = IExchangeProxy(EXCHANGE_PROXY);
        totalAmountIn = _getBalance(tokenIn, totalAmountIn);
        if (tokenIn == ETH_ADDRESS) {
            try
                balancer.multihopBatchSwapExactIn{value: totalAmountIn}(
                    swapSequences,
                    tokenIn,
                    tokenOut,
                    totalAmountIn,
                    minTotalAmountOut
                )
            returns (uint256 amount) {
                totalAmountOut = amount;
            } catch Error(string memory reason) {
                _revertMsg("multihopBatchSwapExactIn", reason);
            } catch {
                _revertMsg("multihopBatchSwapExactIn");
            }
        } else {
            IERC20(tokenIn).safeApprove(EXCHANGE_PROXY, totalAmountIn);
            try
                balancer.multihopBatchSwapExactIn(
                    swapSequences,
                    tokenIn,
                    tokenOut,
                    totalAmountIn,
                    minTotalAmountOut
                )
            returns (uint256 amount) {
                totalAmountOut = amount;
            } catch Error(string memory reason) {
                _revertMsg("multihopBatchSwapExactIn", reason);
            } catch {
                _revertMsg("multihopBatchSwapExactIn");
            }
            IERC20(tokenIn).safeApprove(EXCHANGE_PROXY, 0);
        }

        if (tokenOut != ETH_ADDRESS) _updateToken(tokenOut);
    }

    function multihopBatchSwapExactOut(
        IExchangeProxy.Swap[][] calldata swapSequences,
        address tokenIn,
        address tokenOut,
        uint256 maxTotalAmountIn
    ) external payable returns (uint256 totalAmountIn) {
        IExchangeProxy balancer = IExchangeProxy(EXCHANGE_PROXY);

        if (tokenIn == ETH_ADDRESS) {
            try
                balancer.multihopBatchSwapExactOut{value: maxTotalAmountIn}(
                    swapSequences,
                    tokenIn,
                    tokenOut,
                    maxTotalAmountIn
                )
            returns (uint256 amount) {
                totalAmountIn = amount;
            } catch Error(string memory reason) {
                _revertMsg("multihopBatchSwapExactOut", reason);
            } catch {
                _revertMsg("multihopBatchSwapExactOut");
            }
        } else {
            IERC20(tokenIn).safeApprove(EXCHANGE_PROXY, maxTotalAmountIn);
            try
                balancer.multihopBatchSwapExactOut(
                    swapSequences,
                    tokenIn,
                    tokenOut,
                    maxTotalAmountIn
                )
            returns (uint256 amount) {
                totalAmountIn = amount;
            } catch Error(string memory reason) {
                _revertMsg("multihopBatchSwapExactOut", reason);
            } catch {
                _revertMsg("multihopBatchSwapExactOut");
            }
            IERC20(tokenIn).safeApprove(EXCHANGE_PROXY, 0);
        }

        if (tokenOut != ETH_ADDRESS) _updateToken(tokenOut);
    }

    function smartSwapExactIn(
        address tokenIn,
        address tokenOut,
        uint256 totalAmountIn,
        uint256 minTotalAmountOut,
        uint256 nPools
    ) external payable returns (uint256 totalAmountOut) {
        IExchangeProxy balancer = IExchangeProxy(EXCHANGE_PROXY);

        totalAmountIn = _getBalance(tokenIn, totalAmountIn);
        if (tokenIn == ETH_ADDRESS) {
            try
                balancer.smartSwapExactIn{value: totalAmountIn}(
                    tokenIn,
                    tokenOut,
                    totalAmountIn,
                    minTotalAmountOut,
                    nPools
                )
            returns (uint256 amount) {
                totalAmountOut = amount;
            } catch Error(string memory reason) {
                _revertMsg("smartSwapExactIn", reason);
            } catch {
                _revertMsg("smartSwapExactIn");
            }
        } else {
            IERC20(tokenIn).safeApprove(EXCHANGE_PROXY, totalAmountIn);
            try
                balancer.smartSwapExactIn(
                    tokenIn,
                    tokenOut,
                    totalAmountIn,
                    minTotalAmountOut,
                    nPools
                )
            returns (uint256 amount) {
                totalAmountOut = amount;
            } catch Error(string memory reason) {
                _revertMsg("smartSwapExactIn", reason);
            } catch {
                _revertMsg("smartSwapExactIn");
            }
            IERC20(tokenIn).safeApprove(EXCHANGE_PROXY, 0);
        }

        if (tokenOut != ETH_ADDRESS) _updateToken(tokenOut);
    }

    function smartSwapExactOut(
        address tokenIn,
        address tokenOut,
        uint256 totalAmountOut,
        uint256 maxTotalAmountIn,
        uint256 nPools
    ) external payable returns (uint256 totalAmountIn) {
        IExchangeProxy balancer = IExchangeProxy(EXCHANGE_PROXY);

        if (tokenIn == ETH_ADDRESS) {
            try
                balancer.smartSwapExactOut{value: maxTotalAmountIn}(
                    tokenIn,
                    tokenOut,
                    totalAmountOut,
                    maxTotalAmountIn,
                    nPools
                )
            returns (uint256 amount) {
                totalAmountIn = amount;
            } catch Error(string memory reason) {
                _revertMsg("smartSwapExactOut", reason);
            } catch {
                _revertMsg("smartSwapExactOut");
            }
        } else {
            IERC20(tokenIn).safeApprove(EXCHANGE_PROXY, maxTotalAmountIn);
            try
                balancer.smartSwapExactOut(
                    tokenIn,
                    tokenOut,
                    totalAmountOut,
                    maxTotalAmountIn,
                    nPools
                )
            returns (uint256 amount) {
                totalAmountIn = amount;
            } catch Error(string memory reason) {
                _revertMsg("smartSwapExactOut", reason);
            } catch {
                _revertMsg("smartSwapExactOut");
            }
            IERC20(tokenIn).safeApprove(EXCHANGE_PROXY, 0);
        }

        if (tokenOut != ETH_ADDRESS) _updateToken(tokenOut);
    }
}
