pragma solidity ^0.6.0;

interface IPredicate {
    event LockedEther(
        address indexed depositor,
        address indexed depositReceiver,
        uint256 amount
    );
    event LockedERC20(
        address indexed depositor,
        address indexed depositReceiver,
        address indexed rootToken,
        uint256 amount
    );
}