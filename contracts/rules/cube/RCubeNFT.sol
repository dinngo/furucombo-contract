// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import "../RuleBase.sol";
import "./IStarNFTV4.sol";

contract RCubeNFT is RuleBase {
    uint256 public immutable DISCOUNT;
    IStarNFTV4 public immutable cubeNFT;

    constructor(IStarNFTV4 cube, uint256 discount) {
        cubeNFT = cube;
        DISCOUNT = discount;
    }

    function verify(address usr) public view override returns (bool) {
        return cubeNFT.balanceOf(usr) > 0;
    }

    function calDiscount(address usr) external view override returns (uint256) {
        return verify(usr) ? DISCOUNT : BASE;
    }
}
