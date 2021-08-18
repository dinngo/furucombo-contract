pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "../HandlerBase.sol";
import "./IAggregationExecutor.sol";
import "./IAggregationRouterV3.sol";

contract HOneInchV3 is HandlerBase {
    // using SafeERC20 for IERC20;

    // prettier-ignore
    address public constant ONEINCH_SPENDER = 0x11111112542D85B3EF69AE05771c2dCCff4fAa26;
    // prettier-ignore
    // address public constant REFERRER = 0xBcb909975715DC8fDe643EE44b89e3FD6A35A259;
    // prettier-ignore
    address public constant ETH_ADDRESS = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    function getContractName() public pure override returns (string memory) {
        return "HOneInchV3";
    }

    function swap(
        IAggregationExecutor caller,
        IAggregationRouterV3.SwapDescriptionV3 calldata desc,
        bytes calldata data
    ) external payable returns (uint256 returnAmount) {
        if (_isNotNativeToken(address(desc.srcToken))) {
            // TODO: decide safeApprove or _tokenApprove
            _tokenApprove(address(desc.srcToken), ONEINCH_SPENDER, desc.amount);
            try
                IAggregationRouterV3(ONEINCH_SPENDER).swap(caller, desc, data)
            returns (uint256 amount, uint256) {
                returnAmount = amount;
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
            returns (uint256 amount, uint256) {
                returnAmount = amount;
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
        if (_isNotNativeToken(address(srcToken))) {
            // TODO: decide safeApprove or _tokenApprove
            _tokenApprove(address(srcToken), ONEINCH_SPENDER, amount);
            try
                IAggregationRouterV3(ONEINCH_SPENDER).unoswap(srcToken, amount, minReturn, data)
            returns (uint256 amount) {
                returnAmount = amount;
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
            returns (uint256 amount) {
                returnAmount = amount;
            } catch Error(string memory message) {
                _revertMsg("unoswap", message);
            } catch {
                _revertMsg("unoswap");
            }
        }

        // Update involved token
        if (_isNotNativeToken(address(dstToken)))
            _updateToken(address(dstToken));
    }

    function _isNotNativeToken(address token) internal pure returns (bool) {
        return (token != address(0) && token != ETH_ADDRESS);
    }
}
