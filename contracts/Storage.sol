// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./lib/LibCache.sol";
import "./lib/LibStack.sol";

/// @notice A cache structure composed by a bytes32 array
contract Storage {
    using LibCache for mapping(bytes32 => bytes32);
    using LibStack for bytes32[];

    bytes32[] public stack;
    mapping(bytes32 => bytes32) public cache;

    // keccak256 hash of "msg.sender"
    // prettier-ignore
    bytes32 public constant MSG_SENDER_KEY = 0xb2f2618cecbbb6e7468cc0f2aa43858ad8d153e0280b22285e28e853bb9d453a;

    // keccak256 hash of "fee.rate"
    // prettier-ignore
    bytes32 public constant FEE_RATE_KEY = 0x515323fd14ae1d8e2508b9830a3e80e1a884361823ecf1c0f4d3f345ad226225;

    // keccak256 hash of "fee.collector"
    // prettier-ignore
    bytes32 public constant FEE_COLLECTOR_KEY = 0x0efe2dc3698afe8504a41468034ba33d504aa66b651e1d37f230a3ca6ee9dc72;

    modifier isStackEmpty() {
        require(stack.length == 0, "Stack not empty");
        _;
    }

    modifier isFeeRateZero() {
        require(_getFeeRate() == 0, "Fee rate not zero");
        _;
    }

    modifier isFeeCollectorNotInitialized() {
        require(
            _getFeeCollector() == address(0),
            "Fee collector is initialized"
        );
        _;
    }

    modifier isInitialized() {
        require(_getSender() != address(0), "Sender is not initialized");
        _;
    }

    modifier isNotInitialized() {
        require(_getSender() == address(0), "Sender is initialized");
        _;
    }

    function _setSender() internal isNotInitialized {
        cache.setAddress(MSG_SENDER_KEY, msg.sender);
    }

    function _resetSender() internal {
        cache.setAddress(MSG_SENDER_KEY, address(0));
    }

    function _getSender() internal view returns (address) {
        return cache.getAddress(MSG_SENDER_KEY);
    }

    function _setFeeRate(uint256 _feeRate) internal isFeeRateZero {
        cache.setUint256(FEE_RATE_KEY, _feeRate);
    }

    function _resetFeeRate() internal {
        cache.setUint256(FEE_RATE_KEY, 0);
    }

    function _getFeeRate() internal view returns (uint256) {
        return cache.getUint256(FEE_RATE_KEY);
    }

    function _setFeeCollector(address _collector)
        internal
        isFeeCollectorNotInitialized
    {
        cache.setAddress(FEE_COLLECTOR_KEY, _collector);
    }

    function _resetFeeCollector() internal {
        cache.setAddress(FEE_COLLECTOR_KEY, address(0));
    }

    function _getFeeCollector() internal view returns (address) {
        return cache.getAddress(FEE_COLLECTOR_KEY);
    }
}
