// SPDX-License-Identifier: MIT

pragma solidity 0.8.10;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../HandlerBase.sol";
import "./IWETH9.sol";

contract HWeth is HandlerBase {
    // prettier-ignore
    address public immutable WRAPPED_NATIVE;

    constructor(address wrappedNative_) {
        WRAPPED_NATIVE = wrappedNative_;
    }

    function getContractName() public pure override returns (string memory) {
        return "HWeth";
    }

    function deposit(uint256 value) external payable {
        try IWETH9(WRAPPED_NATIVE).deposit{value: value}() {} catch Error(
            string memory reason
        ) {
            _revertMsg("deposit", reason);
        } catch {
            _revertMsg("deposit");
        }
        _updateToken(WRAPPED_NATIVE);
    }

    function withdraw(uint256 wad) external payable {
        try IWETH9(WRAPPED_NATIVE).withdraw(wad) {} catch Error(
            string memory reason
        ) {
            _revertMsg("withdraw", reason);
        } catch {
            _revertMsg("withdraw");
        }
    }
}
