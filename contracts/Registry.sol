pragma solidity ^0.5.0;

import "@openzeppelin/contracts/ownership/Ownable.sol";

/// @notice The handler registry database for Furucombo
contract Registry is Ownable {
    mapping(address => bytes32) handlers;

    bytes32 constant DEPRECATED = bytes10(0x64657072656361746564);

    /**
     * @notice Register a handler with a bytes32 information.
     * @param registration Handler address.
     * @param info Info string.
     * @dev Dapps that triggers callback function should also be registered.
     * In this case, registration is the Dapp address and the leading 20 bytes
     * of info is the handler address.
     */
    function register(address registration, bytes32 info) external onlyOwner {
        require(registration != address(0), "zero address");
        require(handlers[registration] == bytes32(0), "registered");
        handlers[registration] = info;
    }

    /**
     * @notice Unregister a handler. The handler will be deprecated.
     * @param registration The handler to be unregistered.
     */
    function unregister(address registration) external onlyOwner {
        require(registration != address(0), "zero address");
        require(handlers[registration] != bytes32(0), "no registration");
        require(handlers[registration] != DEPRECATED, "unregistered");
        handlers[registration] = DEPRECATED;
    }

    /**
     * @notice Check if the handler is valid.
     * @param handler The handler to be verified.
     */
    function isValid(address handler) external view returns (bool result) {
        if (handlers[handler] == 0 || handlers[handler] == DEPRECATED)
            return false;
        else return true;
    }

    /**
     * @notice Get the information of a registration.
     * @param handler The handler address to be queried.
     */
    function getInfo(address handler) external view returns (bytes32 info) {
        return handlers[handler];
    }
}
