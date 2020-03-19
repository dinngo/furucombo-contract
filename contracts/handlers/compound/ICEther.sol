pragma solidity ^0.5.0;

interface ICEther {
    function mint() external payable;
    function exchangeRateCurrent() external returns (uint256);

    function totalSupply() external view returns (uint256);
    function balanceOf(address owner) external view returns (uint256 balance);
    function allowance(address, address) external view returns (uint);
    function approve(address, uint) external;
    function transfer(address, uint) external returns (bool);
    function transferFrom(address, address, uint) external returns (bool);
}
