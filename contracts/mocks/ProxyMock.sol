pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "../Proxy.sol";
import "./debug/GasProfiler.sol";

contract ProxyMock is Proxy, GasProfiler {
    constructor(address registry) public Proxy(registry) {}

    function execMock(address to, bytes memory data)
        public
        payable
        returns (bytes memory result)
    {
        _preProcess();
        _setBase();
        result = _exec(to, data);
        _setPostProcess(to);
        _deltaGas("Gas");
        _postProcess();
        return result;
    }

    function _preProcess() internal {
        // Set the sender on the top of cache.
        if (cache.length != 0) {
            cache.set(cache.peek());
            for (uint256 i = cache.length - 1; i > 0; i--) {
                cache[i] = cache[i - 1];
            }
            cache[0] = bytes32(uint256(uint160(msg.sender)));
        } else {
            cache.setSender(msg.sender);
        }
    }

    function updateTokenMock(address token) public {
        cache.setAddress(token);
    }
}
