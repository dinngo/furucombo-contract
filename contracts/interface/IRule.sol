pragma solidity ^0.6.0;

interface IRule {
    /* State Variables Getter */
    function discount() external view returns (uint256);

    /* View Functions */
    function verify(address) external view returns (bool);
    function calDiscount(address) external view returns (uint256);
}
