pragma solidity ^0.6.0;

interface IDepositManager {
    function depositERC20ForUser(address _token, address _user, uint256 _amount) external;
}