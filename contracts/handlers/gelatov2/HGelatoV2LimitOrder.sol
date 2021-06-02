// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "../HandlerBase.sol";
import "./IGelatoPineCore.sol";

contract HGelatoV2LimitOrder is HandlerBase {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    // prettier-ignore
    address public constant GELATO_PINE = 0x36049D479A97CdE1fC6E2a5D2caE30B666Ebf92B;
    // prettier-ignore
    address public constant GELATO_LIMIT_ORDER_MODULE = 0x037fc8e71445910e1E0bBb2a0896d5e9A7485318;

    function getContractName() public pure override returns (string memory) {
        return "HGelatoV2LimitOrder";
    }

    function placeLimitOrder(
        address inToken,
        address outToken,
        uint256 value,
        uint256 minimumReturn,
        address _witness,
        bytes32 _secret
    ) external payable {
        // Transfer funds inside Furu Proxy => Will be done by a separate Handler

        // Get value to be transferred
        // if amount == uint256(-1) return balance of Proxy
        value = _getBalance(inToken, value);

        // Check if Order is sending ETH or ERC20s
        if (inToken == address(0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE)) {
            try
                IGelatoPineCore(GELATO_PINE).depositEth{value: value}(
                    IGelatoPineCore(GELATO_PINE).encodeEthOrder(
                        GELATO_LIMIT_ORDER_MODULE,
                        inToken,
                        payable(_getSender()),
                        _witness,
                        abi.encode(outToken, minimumReturn),
                        _secret
                    )
                )
            {} catch Error(string memory reason) {
                _revertMsg("placeLimitOrder", reason);
            } catch {
                _revertMsg("placeLimitOrder");
            }
        } else {
            (bool success, bytes memory ret) =
                inToken.call(
                    IGelatoPineCore(GELATO_PINE).encodeTokenOrder(
                        GELATO_LIMIT_ORDER_MODULE,
                        IERC20(inToken),
                        payable(_getSender()),
                        _witness,
                        abi.encode(outToken, minimumReturn),
                        _secret,
                        value
                    )
                );

            if (!success) {
                if (ret.length < 68) _revertMsg("placeLimitOrder");
                assembly {
                    ret := add(ret, 0x04)
                }
                _revertMsg("placeLimitOrder", abi.decode(ret, (string)));
            }
        }
    }
}
