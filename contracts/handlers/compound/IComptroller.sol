pragma solidity ^0.6.0;

abstract contract IComptroller {
    function enterMarkets  (address[] calldata cTokens) external virtual returns (uint[] memory);
    function exitMarket(address cToken) external virtual returns (uint);
    function checkMembership(address account, address cToken) external view virtual returns (bool);
    function claimComp(address holder) external virtual;
    function getCompAddress() external virtual returns(address);
}
