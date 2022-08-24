pragma solidity ^0.8.0;

contract FeeCollectorMock {
    uint256 private sum;

    fallback() external payable {
        sum += 1;
    }
}
