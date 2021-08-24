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
    // prettier-ignore
    uint256 private constant _UNISWAP_PAIR_TOKEN0_CALL_SELECTOR_32 = 0x0dfe168100000000000000000000000000000000000000000000000000000000;
    // prettier-ignore
    uint256 private constant _UNISWAP_PAIR_TOKEN1_CALL_SELECTOR_32 = 0xd21220a700000000000000000000000000000000000000000000000000000000;
    // prettier-ignore
    uint256 private constant _ADDRESS_MASK =   0x000000000000000000000000ffffffffffffffffffffffffffffffffffffffff;
    // prettier-ignore
    uint256 private constant _REVERSE_MASK =   0x8000000000000000000000000000000000000000000000000000000000000000;
    // prettier-ignore
    uint256 private constant _WETH_MASK =      0x4000000000000000000000000000000000000000000000000000000000000000;

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
        uint256 minReturn,
        bytes32[] calldata data
    ) external payable returns (uint256 returnAmount) {
        // Interact with 1inch
        if (_isNotNativeToken(address(srcToken))) {
            _tokenApprove(address(srcToken), _ONEINCH_SPENDER, amount);
            try
                IAggregationRouterV3(_ONEINCH_SPENDER).unoswap(
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
                IAggregationRouterV3(_ONEINCH_SPENDER).unoswap{value: amount}(
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

        address dstToken = decode(data);
        // Update involved token
        if (_isNotNativeToken(dstToken)) {
            _updateToken(dstToken);
        }
    }

    function _isNotNativeToken(address token) internal pure returns (bool) {
        return (token != address(0) && token != _ETH_ADDRESS);
    }

    function decode(bytes32[] calldata) public view returns (address ret) {
        assembly {
            function reRevert() {
                returndatacopy(0, 0, returndatasize())
                revert(0, returndatasize())
            }

            // Get last 32 bytes
            let rawPair := calldataload(sub(calldatasize(), 0x20))
            let pair := and(rawPair, _ADDRESS_MASK)
            let emptyPtr := mload(0x40)
            mstore(0x40, add(emptyPtr, 0x20))
            // Check WETH_MASK config
            switch and(rawPair, _WETH_MASK)
                // If WETH_MASK not set, get token address from pair address
                case 0 {
                    switch and(rawPair, _REVERSE_MASK)
                        case 0 {
                            mstore(
                                emptyPtr,
                                _UNISWAP_PAIR_TOKEN1_CALL_SELECTOR_32
                            )
                        }
                        default {
                            mstore(
                                emptyPtr,
                                _UNISWAP_PAIR_TOKEN0_CALL_SELECTOR_32
                            )
                        }
                    if iszero(
                        staticcall(gas(), pair, emptyPtr, 0x4, emptyPtr, 0x20)
                    ) {
                        reRevert()
                    }

                    ret := mload(emptyPtr)
                }
                // If WETH_MASK is set, return zero address
                default {
                    ret := 0x0
                }
        }
    }
}
