// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import "forge-std/Test.sol";
import {Constant} from "./Constant.sol";

contract Utils is Test, Constant {
    function _getSigner(string memory name) internal returns (address) {
        address user = makeAddr(name);
        vm.deal(user, 100 ether);
        return user;
    }
}
