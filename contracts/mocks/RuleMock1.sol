pragma solidity ^0.6.0;

import "../rules/RuleBase.sol";

contract RuleMock1 is RuleBase {
    uint256 public constant override DISCOUNT = BASE * 90/100;

    function verify(address usr) public view override returns (bool) {
        return usr.balance >= 10 ether;
    }

    function calDiscount(address usr) external view override returns (uint256) {
        return verify(usr) ? DISCOUNT : BASE;
    }
}
