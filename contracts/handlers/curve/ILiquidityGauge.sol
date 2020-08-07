pragma solidity ^0.5.0;

interface ILiquidityGuage {
    function deposit(uint256 _value) external;
    function withdraw(uint256 _value) external;
}
