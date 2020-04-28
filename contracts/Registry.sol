pragma solidity ^0.5.0;

import "@openzeppelin/contracts/ownership/Ownable.sol";


contract Registry is Ownable {
  mapping(address => bytes32) handlers;

  bytes32 constant DEPRECATED = bytes10(0x64657072656361746564);

  function register(address registration, bytes32 info) external onlyOwner {
    require(registration != address(0), "zero address");
    require(handlers[registration] == bytes32(0), "registered");
    handlers[registration] = info;
  }

  function unregister(address registration) external onlyOwner {
    require(registration != address(0), "zero address");
    require(handlers[registration] != bytes32(0), "no registration");
    require(handlers[registration] != DEPRECATED, "unregistered");
    handlers[registration] = DEPRECATED;
  }

  function isValid(address handler) external view returns (bool result) {
    if (handlers[handler] == 0 || handlers[handler] == DEPRECATED) return false;
    else return true;
  }

  function getInfo(address handler) external view returns (bytes32 info) {
    return handlers[handler];
  }
}
