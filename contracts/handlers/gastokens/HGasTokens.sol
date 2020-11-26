pragma solidity ^0.6.0;

import "@openzeppelin/contracts/math/Math.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "../HandlerBase.sol";
import "./IGasTokens.sol";

contract HGasTokens is HandlerBase {
    using SafeERC20 for IERC20;

    // prettier-ignore
    address public constant CHI_TOKEN = 0x0000000000004946c0e9F43F4Dee607b0eF1fA1c;
    // prettier-ignore
    address public constant GST2_TOKEN = 0x0000000000b3F879cb30FE243b4Dfee438691c04;

    function getContractName() public override pure returns (string memory) {
        return "HGasToken";
    }

    function freeCHI(uint256 amount) external payable {
        uint256 gasStart = 21000 + gasleft() + 16 * msg.data.length;

        // Update post process
        bytes32[] memory params = new bytes32[](2);
        params[0] = bytes32(gasStart);
        params[1] = bytes32(amount);

        _updatePostProcess(params);
    }

    function freeGST2(uint256 amount) external payable {
        uint256 gasStart = 21000 + gasleft() + 16 * msg.data.length;

        // Update post process
        bytes32[] memory params = new bytes32[](2);
        params[0] = bytes32(gasStart);
        params[1] = bytes32(amount);

        _updatePostProcess(params);
    }

    function postProcess() external override payable {
        bytes4 sig = stack.getSig();
        uint256 gasStart = uint256(stack.get());
        uint256 amount = uint256(stack.get());
        // selector of freeCHI(uint256) and freeGST2(uint256)
        if (sig == 0x4cc943c0) {
            _freeCHI(gasStart, amount);
        } else if (sig == 0xcc608747) {
            _freeGST2(gasStart, amount);
        } else revert("Invalid post process");
    }

    function _freeCHI(uint256 gasStart, uint256 amount) internal {
        uint256 gasSpent = gasStart - gasleft();
        uint256 maxAmount = (gasSpent + 14154) / 41947;
        try
            IGasTokens(CHI_TOKEN).freeFromUpTo(
                _getSender(),
                Math.min(amount, maxAmount)
            )
         {} catch Error(string memory reason) {
            _revertMsg("_freeCHI", reason);
        } catch {
            _revertMsg("_freeCHI");
        }
    }

    function _freeGST2(uint256 gasStart, uint256 amount) internal {
        uint256 gasSpent = gasStart - gasleft();
        uint256 maxAmount = (gasSpent + 14154) / 41130; // 41130 = (24000*2-6870)
        try
            IGasTokens(GST2_TOKEN).freeFromUpTo(
                _getSender(),
                Math.min(amount, maxAmount)
            )
         {} catch Error(string memory reason) {
            _revertMsg("_freeGST2", reason);
        } catch {
            _revertMsg("_freeGST2");
        }
    }
}
