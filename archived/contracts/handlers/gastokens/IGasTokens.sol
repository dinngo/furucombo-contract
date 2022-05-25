pragma solidity ^0.6.0;

interface IGasTokens {
    function balanceOf(address account) external view returns (uint256);

    function freeFromUpTo(address from, uint256 value)
        external
        returns (uint256);
}
