// SPDX-License-Identifier: MIT

pragma solidity 0.8.10;

import "../HandlerBase.sol";
import "./IAggregationExecutorV4.sol";
import "./IAggregationRouterV4.sol";

contract HOneInchV4 is HandlerBase {
    IAggregationRouterV4 public immutable oneInchRouter;

    function getContractName() public pure override returns (string memory) {
        return "HOneInchV4";
    }

    constructor(address oneInchRouter_) {
        oneInchRouter = IAggregationRouterV4(oneInchRouter_);
    }

    function swap(
        IAggregationExecutorV4 caller,
        IAggregationRouterV4.SwapDescriptionV4 calldata desc,
        bytes calldata data
    ) external payable returns (uint256 returnAmount) {
        if (_isNotNativeToken(address(desc.srcToken))) {
            _tokenApprove(
                address(desc.srcToken),
                address(oneInchRouter),
                desc.amount
            );
            try oneInchRouter.swap(caller, desc, data) returns (
                uint256 ret,
                uint256,
                uint256
            ) {
                returnAmount = ret;
            } catch Error(string memory message) {
                _revertMsg("swap", message);
            } catch {
                _revertMsg("swap");
            }
            _tokenApproveZero(address(desc.srcToken), address(oneInchRouter));
        } else {
            try
                oneInchRouter.swap{value: desc.amount}(caller, desc, data)
            returns (uint256 ret, uint256, uint256) {
                returnAmount = ret;
            } catch Error(string memory message) {
                _revertMsg("swap", message);
            } catch {
                _revertMsg("swap");
            }
        }

        // Update involved token
        if (_isNotNativeToken(address(desc.dstToken)))
            _updateToken(address(desc.dstToken));
    }

    function unoswap(
        IERC20 srcToken,
        uint256 amount,
        IERC20 dstToken,
        bytes calldata data
    ) external payable returns (uint256 returnAmount) {
        // Get dstToken balance before executing unoswap
        uint256 dstTokenBalanceBefore =
            _getBalance(address(dstToken), type(uint256).max);

        // Interact with 1inch
        if (_isNotNativeToken(address(srcToken))) {
            // ERC20 token need to approve before unoswap
            _tokenApprove(address(srcToken), address(oneInchRouter), amount);
            returnAmount = _unoswapCall(0, data);
            _tokenApproveZero(address(srcToken), address(oneInchRouter));
        } else {
            returnAmount = _unoswapCall(amount, data);
        }

        // Check, dstToken balance should be increased
        uint256 dstTokenBalanceAfter =
            _getBalance(address(dstToken), type(uint256).max);
        _requireMsg(
            dstTokenBalanceAfter - dstTokenBalanceBefore == returnAmount,
            "unoswap",
            "Invalid output token amount"
        );

        // Update involved token
        if (_isNotNativeToken(address(dstToken))) {
            _updateToken(address(dstToken));
        }
    }

    function _unoswapCall(uint256 value, bytes calldata data)
        internal
        returns (uint256 returnAmount)
    {
        // Interact with 1inch through contract call with data
        (bool success, bytes memory returnData) =
            address(oneInchRouter).call{value: value}(data);

        // Verify return status and data
        if (success) {
            returnAmount = abi.decode(returnData, (uint256));
        } else {
            if (returnData.length < 68) {
                // If the returnData length is less than 68, then the transaction failed silently.
                _revertMsg("unoswap");
            } else {
                // Look for revert reason and bubble it up if present
                assembly {
                    returnData := add(returnData, 0x04)
                }
                _revertMsg("unoswap", abi.decode(returnData, (string)));
            }
        }
    }
}
