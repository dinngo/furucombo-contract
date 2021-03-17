pragma solidity ^0.6.0;

interface IRCOMBO {
    function provideFor(address, uint256) external;
    function withdrawFor(address) external;
}
