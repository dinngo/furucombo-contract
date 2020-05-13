pragma solidity ^0.5.0;

import "../Cache.sol";


contract HandlerBase is Cache {
    modifier addFunctionSelector() {
        _;
        _setCache(msg.sig);
    }

    function _updateToken(address token) internal {
        _setCacheAddress(token);
        _setCache(bytes32(0));
    }
}
