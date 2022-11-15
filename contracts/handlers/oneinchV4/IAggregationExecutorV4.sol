// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IAggregationExecutorV4 {
    function callBytes(address msgSender, bytes calldata data) external payable; // 0x2636f7f8
}
