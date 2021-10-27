// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

import "./IGasDiscountExtension.sol";

interface IAggregationExecutor is IGasDiscountExtension {
    function callBytes(bytes calldata data) external payable;  // 0xd9c45357
}
