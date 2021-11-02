// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./IChi.sol";

interface IGasDiscountExtension {
    function calculateGas(uint256 gasUsed, uint256 flags, uint256 calldataLength) external pure returns (IChi, uint256);
}
