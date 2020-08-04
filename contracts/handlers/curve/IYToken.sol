pragma solidity ^0.5.0;

interface IYToken {
    function deposit(uint256 mintAmount) external;

    function balanceOf(address account) external view returns (uint256);
}
