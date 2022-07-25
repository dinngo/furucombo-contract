pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

contract FeeCollectorMock {
    uint256 private sum;

    fallback() external payable {
        sum += 1;
    }
}
