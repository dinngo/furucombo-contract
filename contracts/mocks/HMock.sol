pragma solidity ^0.5.0;

contract HMock {
    function test(uint256 v) external payable {
        address(0).call.value(v)("");
    }
}
