pragma solidity ^0.6.0;

abstract contract IComptroller {
    function enterMarkets  (address[] calldata cTokens) external virtual returns (uint[] memory);
    function exitMarket(address cToken) external virtual returns (uint);
    function claimComp(address holder) external virtual;
}
