pragma solidity ^0.5.0;

contract IComptroller {
    function enterMarkets(address[] calldata cTokens) external returns (uint[] memory);
    function exitMarket(address cToken) external returns (uint);
    function checkMembership(address account, address cToken) external view returns (bool);
    function claimComp(address holder) external;
}
