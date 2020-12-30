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
    address public constant ETH_ADDRESS =
        0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    function getContractName() public pure override returns (string memory) {
        return "HOneInchV2";
    }

    // Discounted swap is the swapping function that applies
    // gas token.
    // Might be ok to remove since we support gas token natively.
    function discountedSwap(uint256 value, bytes calldata data)
        external
        payable
        returns (uint256 returnAmount)
    {
        (, , IOneInchExchangeV2.SwapDescription memory desc, ) =
            abi.decode(
                data,
                (
                    bytes4,
                    IOneInchCaller,
                    IOneInchExchangeV2.SwapDescription,
                    IOneInchCaller.CallDescription[]
                )
            );

        if (address(desc.srcToken) != ETH_ADDRESS)
            desc.srcToken.safeApprove(ONEINCH_SPENDER, desc.amount);
        (bool success, bytes memory ret) =
            ONEINCH_SPENDER.call{value: value}(data);
        if (success) {
            (returnAmount) = abi.decode(ret, (uint256));
        } else {
            _revertMsg("discountedSwap", string(ret));
        }
        if (address(desc.srcToken) != ETH_ADDRESS)
            desc.srcToken.safeApprove(ONEINCH_SPENDER, 0);

        // Update involved token
        if (address(desc.dstToken) != ETH_ADDRESS)
            _updateToken(address(desc.dstToken));
    }

    // TODO: srcToken, dstToken, amount can be fetched from the
    // SwapDescription in data.
    function swap(
        uint256 value,
        IERC20 srcToken,
        IERC20 dstToken,
        uint256 amount,
        bytes memory data
    ) public payable returns (uint256 returnAmount) {
        if (address(srcToken) != ETH_ADDRESS) {
            srcToken.safeApprove(ONEINCH_SPENDER, amount);
            (bool success, bytes memory ret) =
                ONEINCH_SPENDER.call{value: value}(data);
            if (success) {
                (returnAmount) = abi.decode(ret, (uint256));
            } else {
                _revertMsg("swap", string(ret));
            }
            srcToken.safeApprove(ONEINCH_SPENDER, 0);
        } else {
            (bool success, bytes memory ret) =
                ONEINCH_SPENDER.call{value: value}(data);
            if (success) {
                (returnAmount) = abi.decode(ret, (uint256));
            } else {
                _revertMsg("swap", string(ret));
            }
        }

        // Update involved token
        if (address(dstToken) != ETH_ADDRESS) _updateToken(address(dstToken));
    }
}
