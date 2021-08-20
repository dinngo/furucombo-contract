pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";

import "../HandlerBase.sol";
import "./IAggregationExecutor.sol";
import "./IAggregationRouterV3.sol";

contract HOneInchV3 is HandlerBase {
    using SafeMath for uint256;

    // prettier-ignore
    address private constant ONEINCH_SPENDER = 0x11111112542D85B3EF69AE05771c2dCCff4fAa26;
    // prettier-ignore
    address private constant ETH_ADDRESS = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    function getContractName() public override pure returns (string memory) {
        return "HOneInchV3";
    }

    function swap(
        IAggregationExecutor caller,
        IAggregationRouterV3.SwapDescriptionV3 calldata desc,
        bytes calldata data
    ) external payable returns (uint256 returnAmount) {
        if (_isNotNativeToken(address(desc.srcToken))) {
            _tokenApprove(address(desc.srcToken), ONEINCH_SPENDER, desc.amount);
            try
                IAggregationRouterV3(ONEINCH_SPENDER).swap(caller, desc, data)
            returns (uint256 ret, uint256) {
                returnAmount = ret;
            } catch Error(string memory message) {
                _revertMsg("swap", message);
            } catch {
                _revertMsg("swap");
            }
        } else {
            try
                IAggregationRouterV3(ONEINCH_SPENDER).swap{value: desc.amount}(
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
        uint256 minReturn,
        bytes32[] calldata data,
        IERC20 dstToken
    ) external payable returns (uint256 returnAmount) {
        // Snapshot dstToken balance
        uint256 tokenBefore = _getBalance(address(dstToken), uint256(-1));

        // Interact with 1inch
        if (_isNotNativeToken(address(srcToken))) {
            _tokenApprove(address(srcToken), ONEINCH_SPENDER, amount);
            try
                IAggregationRouterV3(ONEINCH_SPENDER).unoswap(
                    srcToken,
                    amount,
                    minReturn,
                    data
                )
            returns (uint256 ret) {
                returnAmount = ret;
            } catch Error(string memory message) {
                _revertMsg("unoswap", message);
            } catch {
                _revertMsg("unoswap");
            }
        } else {
            try
                IAggregationRouterV3(ONEINCH_SPENDER).unoswap{value: amount}(
                    srcToken,
                    amount,
                    minReturn,
                    data
                )
            returns (uint256 ret) {
                returnAmount = ret;
            } catch Error(string memory message) {
                _revertMsg("unoswap", message);
            } catch {
                _revertMsg("unoswap");
            }
        }

        // Snapshot dstToken balance after swap
        uint256 tokenAfter = _getBalance(address(dstToken), uint256(-1));

        // Verify dstToken balance diff
        if (tokenAfter.sub(tokenBefore) != returnAmount)
            _revertMsg("unoswap", "balance diff not match return amount");

        // Update involved token
        if (_isNotNativeToken(address(dstToken))) {
            _updateToken(address(dstToken));
        }
    }

    function _isNotNativeToken(address token) internal pure returns (bool) {
        return (token != address(0) && token != ETH_ADDRESS);
    }
}
