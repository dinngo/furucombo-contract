pragma solidity ^0.6.0;


interface IRegistry {
    function isValid(address handler) external view returns (bool result);

    function getInfo(address handler) external view returns (bytes32 info);
}
