pragma solidity ^0.6.6;

interface IRootChainManager {
    function depositEtherFor(address user) external payable;
    function depositFor(
        address user,
        address rootToken,
        bytes calldata depositData
    ) external;
}