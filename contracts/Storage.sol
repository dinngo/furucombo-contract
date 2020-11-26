pragma solidity ^0.6.0;

import "./lib/LibCache.sol";
import "./lib/LibStack.sol";

/// @notice A cache structure composed by a bytes32 array
contract Storage {
    using LibCache for mapping(bytes32 => bytes32);
    using LibStack for bytes32[];

    bytes32[] public stack;
    mapping(bytes32 => bytes32) public cache;

    modifier isStackEmpty() {
        require(stack.length == 0, "Stack not empty");
        _;
    }

    function _setSender() internal {
        if (_getSender() == address(0))
            cache.setAddress(keccak256("msg.sender"), msg.sender);
    }

    function _getSender() internal view returns (address) {
        return cache.getAddress(keccak256("msg.sender"));
    }
}
