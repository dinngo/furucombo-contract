// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../HandlerBase.sol";
import "./IWETH9.sol";

contract HWeth is HandlerBase {
    // prettier-ignore
    address payable public constant WETH = payable(address(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2));

    function getContractName() public pure override returns (string memory) {
        return "HWeth";
    }

    function deposit(uint256 value) external payable {
        try IWETH9(WETH).deposit{value: value}() {} catch Error(
            string memory reason
        ) {
            _revertMsg("deposit", reason);
        } catch {
            _revertMsg("deposit");
        }
        _updateToken(WETH);
    }

    function withdraw(uint256 wad) external payable {
        try IWETH9(WETH).withdraw(wad) {} catch Error(string memory reason) {
            _revertMsg("withdraw", reason);
        } catch {
            _revertMsg("withdraw");
        }
    }
}
