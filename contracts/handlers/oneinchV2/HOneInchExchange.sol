pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "../HandlerBase.sol";
import "./IOneInchCaller.sol";
import "./IOneInchExchangeV2.sol";

contract HOneInchExchange is HandlerBase {
    using SafeERC20 for IERC20;

    // prettier-ignore
    address public constant ONEINCH_SPENDER = 0x111111125434b319222CdBf8C261674aDB56F3ae;
    // prettier-ignore
    address public constant REFERRER = 0xBcb909975715DC8fDe643EE44b89e3FD6A35A259;
    // prettier-ignore
    address public constant ETH_ADDRESS = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    function getContractName() public pure override returns (string memory) {
        return "HOneInchV2";
    }

    function swap(
        IOneInchCaller caller,
        IOneInchExchangeV2.SwapDescription memory desc,
        IOneInchCaller.CallDescription[] calldata calls
    ) external payable returns (uint256 returnAmount) {
        desc.referrer = REFERRER;
        if (address(desc.srcToken) != ETH_ADDRESS) {
            desc.srcToken.safeApprove(ONEINCH_SPENDER, desc.amount);
            try
                IOneInchExchangeV2(ONEINCH_SPENDER).swap(caller, desc, calls)
            returns (uint256 amount) {
                returnAmount = amount;
            } catch Error(string memory message) {
                _revertMsg("swap", message);
            } catch {
                _revertMsg("swap");
            }
            desc.srcToken.safeApprove(ONEINCH_SPENDER, 0);
        } else {
            try
                IOneInchExchangeV2(ONEINCH_SPENDER).swap{value: desc.amount}(
                    caller,
                    desc,
                    calls
                )
            returns (uint256 amount) {
                returnAmount = amount;
            } catch Error(string memory message) {
                _revertMsg("swap", message);
            } catch {
                _revertMsg("swap");
            }
        }

        // Update involved token
        if (address(desc.dstToken) != ETH_ADDRESS)
            _updateToken(address(desc.dstToken));
    }
}
