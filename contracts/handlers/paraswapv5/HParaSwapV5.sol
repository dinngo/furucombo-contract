// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "../HandlerBase.sol";
import "./IAugustusSwapper.sol";

contract HParaSwapV5 is HandlerBase {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    // prettier-ignore
    address public constant AUGUSTUS_SWAPPER = 0xDEF171Fe48CF0115B1d80b88dc8eAB59176FEe57;

    function getContractName() public pure override returns (string memory) {
        return "HParaSwapV5";
    }

    function swap(
        address srcToken,
        uint256 amount,
        address destToken,
        bytes calldata data
    ) external payable returns (uint256) {
        uint256 destTokenBalanceBefore =
            _getBalance(destToken, type(uint256).max);

        address tokenTransferProxy =
            IAugustusSwapper(AUGUSTUS_SWAPPER).getTokenTransferProxy();

        if (_isNotNativeToken(srcToken)) {
            // ERC20 token need to approve before paraswap
            _tokenApprove(srcToken, tokenTransferProxy, amount);
            _paraswapCall(0, data);
            _tokenApproveZero(srcToken, tokenTransferProxy);
        } else {
            _paraswapCall(amount, data);
        }

        if (_isNotNativeToken(destToken)) {
            _updateToken(destToken);
        }

        uint256 destTokenBalanceAfter =
            _getBalance(destToken, type(uint256).max);

        return destTokenBalanceAfter.sub(destTokenBalanceBefore);
    }

    function _paraswapCall(uint256 value, bytes calldata data) internal {
        // Interact with paraswap through contract call with data
        (bool success, bytes memory returnData) =
            AUGUSTUS_SWAPPER.call{value: value}(data);

        if (!success) {
            if (returnData.length < 68) {
                // If the returnData length is less than 68, then the transaction failed silently.
                _revertMsg("paraswap");
            } else {
                // Look for revert reason and bubble it up if present
                assembly {
                    returnData := add(returnData, 0x04)
                }
                _revertMsg("paraswap", abi.decode(returnData, (string)));
            }
        }
    }
}
