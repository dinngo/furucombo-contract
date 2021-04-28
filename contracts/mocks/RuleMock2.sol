pragma solidity ^0.6.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../rules/RuleBase.sol";

contract RuleMock2 is RuleBase {
    uint256 public constant override DISCOUNT = BASE * 80/100;
    address public constant COMBO = 0xfFffFffF2ba8F66D4e51811C5190992176930278;

    function verify(address usr) public view override returns (bool) {
        return IERC20(COMBO).balanceOf(usr) >= 500e18;
    }

    function calDiscount(address usr) external view override returns (uint256) {
        return verify(usr) ? DISCOUNT : BASE;
    }
}
