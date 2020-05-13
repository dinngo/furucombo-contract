pragma solidity ^0.5.0;


contract HandlerBase {
    bytes32[] cache;

    function _updateToken(address token) internal {
        cache.push(bytes20(token));
    }
}
