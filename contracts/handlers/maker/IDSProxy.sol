pragma solidity ^0.5.0;

interface IDSProxy {
    function execute(address _target, bytes calldata _data) external payable returns (bytes32 response);
    function owner() external view returns (address);
}

interface IDSProxyFactory {
    function isProxy(address proxy) external view returns (bool);
    function build() external returns (address);
    function build(address owner) external returns (address);
}

interface IDSProxyRegistry {
    function proxies(address input) external returns (address);
    function build() external returns (address);
    function build(address owner) external returns (address);
}
