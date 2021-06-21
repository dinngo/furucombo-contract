// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "../HandlerBase.sol";
import "./IGelatoPineCore.sol";

contract HGelatoV2LimitOrder is HandlerBase {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    address public immutable GELATO_PINE;
    address public immutable GELATO_LIMIT_ORDER_MODULE;

    constructor(address _gelatoPine, address _module) public {
        GELATO_PINE = _gelatoPine;
        GELATO_LIMIT_ORDER_MODULE = _module;
    }

    function getContractName() public pure override returns (string memory) {
        return "HGelatoV2LimitOrder";
    }

    function placeLimitOrder(
        uint256 value,
        address module, // unused, only for gelato graph bot
        address inToken,
        address payable owner, // unused, only for gelato graph bot
        address _witness,
        bytes calldata limitOrderData,
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
                        limitOrderData,
                        _secret
                    )
                )
            {} catch Error(string memory reason) {
                _revertMsg("placeLimitOrder", reason);
            } catch {
                _revertMsg("placeLimitOrder");
            }
        } else {
            try
                IERC20(inToken).transfer(
                    IGelatoPineCore(GELATO_PINE).vaultOfOrder(
                        GELATO_LIMIT_ORDER_MODULE,
                        inToken,
                        payable(_getSender()),
                        _witness,
                        limitOrderData
                    ),
                    value
                )
            {} catch Error(string memory reason) {
                _revertMsg("placeLimitOrder", reason);
            } catch {
                _revertMsg("placeLimitOrder");
            }
        }
    }
}
