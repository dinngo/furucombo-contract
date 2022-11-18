// SPDX-License-Identifier: MIT

pragma solidity 0.8.10;

import "./Foo.sol";
import "contracts/handlers/HandlerBase.sol";

contract FooHandler is HandlerBase {
    event FooBytes32(bytes32 a);
    event FooUint256(uint256 b);

    function getContractName() public pure override returns (string memory) {
        return "FooHandler";
    }

    function bar(address to) external payable returns (bytes32 ret) {
        ret = Foo(to).bar();
    }

    function barUint(address to) external payable returns (uint256 ret) {
        ret = Foo(to).barUint();
    }

    function barUint1(address to, uint256 a)
        external
        payable
        returns (uint256 ret)
    {
        ret = Foo(to).barUint1(a);
    }

    function bar10(
        address to,
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
    ) external payable returns (bytes32[] memory ret) {
        ret = Foo(to).bar10(a0, a1, a2, a3, a4, a5, a6, a7, a8, a9);
    }
}
