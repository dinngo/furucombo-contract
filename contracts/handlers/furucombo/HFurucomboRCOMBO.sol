pragma solidity ^0.6.0;

import "../HandlerBase.sol";
import "./IRCOMBO.sol";

contract HFurucomboRCOMBO is HandlerBase {
    function getContractName() public pure override returns (string memory) {
        return "HFurucomboRCOMBO";
    }

    function provideFor(address rCOMBOAddress, uint256 amount)
        external
        payable
    {
        IRCOMBO rCOMBO = IRCOMBO(rCOMBOAddress);
        amount = _getBalance(rCOMBOAddress, amount);
        require(amount > 0, "provideFor: provide 0 amount");
        rCOMBO.provideFor(_getSender(), amount);
    }

    function withdrawFor(address rCOMBOAddress) external payable {
        IRCOMBO rCOMBO = IRCOMBO(rCOMBOAddress);
        rCOMBO.withdrawFor(_getSender());
    }
}
