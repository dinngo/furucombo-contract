pragma solidity >=0.6.0;

interface IMooniFactory {
    function pools(address, address) external view returns (address);
}
