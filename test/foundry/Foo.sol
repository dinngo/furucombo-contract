// SPDX-License-Identifier: MIT

pragma solidity 0.8.10;

contract Foo {
    bytes32[] public bValues = new bytes32[](15);
    uint256 public nValue;

    function bar() external pure returns (bytes32) {
        return
            0x0000000000000000000000000000000000000000000000000123456789abcdef;
    }

    function barUint() external pure returns (uint256) {
        return 1 ether;
    }

    function barUint1(uint256 a) external returns (uint256) {
        nValue = a;
        return nValue;
    }

    function bar10(
        bytes32 a0,
        bytes32 a1,
        bytes32 a2,
        bytes32 a3,
        bytes32 a4,
        bytes32 a5,
        bytes32 a6,
        bytes32 a7,
        bytes32 a8,
        bytes32 a9
    ) external returns (bytes32[] memory) {
        bValues[0] = a0;
        bValues[1] = a1;
        bValues[2] = a2;
        bValues[3] = a3;
        bValues[4] = a4;
        bValues[5] = a5;
        bValues[6] = a6;
        bValues[7] = a7;
        bValues[8] = a8;
        bValues[9] = a9;

        return bValues;
    }
}
