pragma solidity ^0.5.0;

contract Foo4 {
    bytes32 public bValue;
    uint256 public nValue;

    function bar() external returns (bytes32) {
        bValue = 0x0000000000000000000000000000000000000000000000000123456789abcdef;
        return bValue;
    }

    function barUint() external returns (uint256) {
        nValue = 1 ether;
        return nValue;
    }

    function bar1(bytes32 a) external returns (bytes32) {
        bValue = a;
        return bValue;
    }

    function bar2(bytes32 a, bytes32 b) external returns (bytes32) {
        bValue = b;
        return bValue;
    }

    function barUint1(uint256 a) external returns (uint256) {
        nValue = a;
        return nValue;
    }
}
