// SPDX-License-Identifier: MIT

pragma solidity 0.8.9;

import "../HandlerBase.sol";
import "./IRCOMBO.sol";

contract HFurucomboRCOMBO is HandlerBase {
    address public constant RCOMBO = 0x2DaDc3582C0655E8D21b1519baC30Bc40Ab14E9A;

    function getContractName() public pure override returns (string memory) {
        return "HFurucomboRCOMBO";
    }

    function provideFor(uint256 amount) external payable {
        amount = _getBalance(RCOMBO, amount);
        _requireMsg(amount > 0, "provideFor", "provide 0 amount");
        IRCOMBO(RCOMBO).provideFor(_getSender(), amount);
    }

    function withdrawFor() external payable {
        IRCOMBO(RCOMBO).withdrawFor(_getSender());
    }
}
