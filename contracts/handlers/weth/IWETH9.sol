pragma solidity ^0.5.0;

interface IWETH9 {
    function() external payable;
    function deposit() external payable;
    function withdraw(uint256 wad) external;
}
