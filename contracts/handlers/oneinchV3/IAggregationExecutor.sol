pragma solidity ^0.6.0;

import "../oneinchV2/IGasDiscountExtension.sol";

interface IAggregationExecutor is IGasDiscountExtension {
    function callBytes(bytes calldata data) external payable;  // 0xd9c45357
}