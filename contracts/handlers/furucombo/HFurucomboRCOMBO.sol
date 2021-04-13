pragma solidity ^0.6.0;

import "../HandlerBase.sol";
import "./IRCOMBO.sol";

contract HFurucomboRCOMBO is HandlerBase {
    address public constant RCOMBO = 0x2DaDc3582C0655E8D21b1519baC30Bc40Ab14E9A;

    function getContractName() public pure override returns (string memory) {
        return "HFurucomboRCOMBO";
    }

    function provideFor(uint256 amount) external payable {
        IRCOMBO rCOMBO = IRCOMBO(RCOMBO);
        amount = _getBalance(RCOMBO, amount);
        if (amount <= 0) {
            _revertMsg("provideFor", "provide 0 amount");
        }
        rCOMBO.provideFor(_getSender(), amount);
    }

    function withdrawFor() external payable {
        IRCOMBO rCOMBO = IRCOMBO(RCOMBO);
        rCOMBO.withdrawFor(_getSender());
    }
}
