pragma solidity >=0.5.0;

interface IMooniFactory {
    function pools(address, address) external view returns (address);
}
