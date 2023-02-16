// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.0;
pragma abicoder v2;

interface IPool {
    function token() external view returns(address);
}
