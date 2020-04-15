pragma solidity ^0.5.0;

import "../HandlerBase.sol";
import "./ICEther.sol";

contract HCEther is HandlerBase {
    address constant CETHER = 0x4Ddc2D193948926D02f9B1fE9e1daa0718270ED5;

    function mint(uint256 value) external payable {
        ICEther compound = ICEther(CETHER);
        compound.mint.value(value)();

        // Update involved token
        _updateToken(CETHER);
    }
}
