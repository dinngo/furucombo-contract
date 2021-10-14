// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "../HandlerBase.sol";
import "./IGelatoPineCore.sol";
import "./IERC20OrderRouter.sol";

contract HGelatoV2LimitOrder is HandlerBase {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    // prettier-ignore
    address public immutable GELATO_PINE;
    address public immutable ERC20_ORDER_ROUTER;

    constructor(address _gelatoPine, address _erc20OrderRouter) public {
        GELATO_PINE = _gelatoPine;
        ERC20_ORDER_ROUTER = _erc20OrderRouter;
    }

    function getContractName() public pure override returns (string memory) {
        return "HGelatoV2LimitOrder";
    }

    function placeLimitOrder(
        uint256 value,
        address module,
        address inToken,
        address payable owner,
        address witness,
        bytes calldata limitOrderData,
        bytes32 secret
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
                        module,
                        inToken,
                        payable(_getSender()),
                        witness,
                        limitOrderData,
                        secret
                    )
                )
            {} catch Error(string memory reason) {
                _revertMsg("placeLimitOrder", reason);
            } catch {
                _revertMsg("placeLimitOrder");
            }
        } else {
            _tokenApprove(inToken, ERC20_ORDER_ROUTER, value);
            try
                IERC20OrderRouter(ERC20_ORDER_ROUTER).depositToken(
                    value,
                    module,
                    inToken,
                    owner,
                    witness,
                    limitOrderData,
                    secret
                )
            {} catch Error(string memory reason) {
                _revertMsg("placeLimitOrder", reason);
            } catch {
                _revertMsg("placeLimitOrder");
            }
        }
    }
}
