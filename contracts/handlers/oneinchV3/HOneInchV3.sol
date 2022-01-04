pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";

import "../HandlerBase.sol";
import "./IAggregationExecutor.sol";
import "./IAggregationRouterV3.sol";

contract HOneInchV3 is HandlerBase {
    using SafeMath for uint256;

    // prettier-ignore
    address private constant _ONEINCH_SPENDER = 0x11111112542D85B3EF69AE05771c2dCCff4fAa26;
    // prettier-ignore
    address private constant _ETH_ADDRESS = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    function getContractName() public pure override returns (string memory) {
        return "HOneInchV3";
    }

    function swap(
        IAggregationExecutor caller,
        IAggregationRouterV3.SwapDescriptionV3 calldata desc,
        bytes calldata data
    ) external payable returns (uint256 returnAmount) {
        if (_isNotNativeToken(address(desc.srcToken))) {
            _tokenApprove(
                address(desc.srcToken),
                _ONEINCH_SPENDER,
                desc.amount
            );
            try
                IAggregationRouterV3(_ONEINCH_SPENDER).swap(caller, desc, data)
            returns (uint256 ret, uint256) {
                returnAmount = ret;
            } catch Error(string memory message) {
                _revertMsg("swap", message);
            } catch {
                _revertMsg("swap");
            }
        } else {
            try
                IAggregationRouterV3(_ONEINCH_SPENDER).swap{value: desc.amount}(
                    caller,
                    desc,
                    data
                )
            returns (uint256 ret, uint256) {
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
            _tokenApprove(address(srcToken), _ONEINCH_SPENDER, amount);
            returnAmount = _unoswapCall(0, data);
        } else {
            returnAmount = _unoswapCall(amount, data);
        }

        // Check, dstToken balance should be increased
        uint256 dstTokenBalanceAfter =
            _getBalance(address(dstToken), type(uint256).max);
        if (dstTokenBalanceAfter.sub(dstTokenBalanceBefore) != returnAmount) {
            _revertMsg("unoswap", "Invalid output token amount");
        }

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
            _ONEINCH_SPENDER.call{value: value}(data);

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
