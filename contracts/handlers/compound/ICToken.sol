pragma solidity ^0.5.0;

interface ICToken {
    function mint(uint256 amount) external returns (uint256);
    function underlying() external view returns (address);
}
