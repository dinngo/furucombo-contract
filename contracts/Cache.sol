pragma solidity ^0.5.0;


contract Cache {
    bytes32[] cache;

    modifier isCacheEmpty() {
        require(cache.length == 0, "Cache not empty");
        _;
    }

    function _setCacheAddress(address input) internal {
        cache.push(bytes20(input));
    }

    function _setCacheSig(bytes4 input) internal {
        cache.push(input);
    }

    function _setCache(bytes32 input) internal {
        cache.push(input);
    }

    function _getCacheAddress() internal returns (address ret) {
        ret = address(bytes20(cache[cache.length - 1]));
        cache.pop();
    }

    function _getCacheSig() internal returns (bytes4 ret) {
        ret = bytes4(cache[cache.length - 1]);
        cache.pop();
    }

    function _getCache() internal returns (bytes32 ret) {
        ret = cache[cache.length - 1];
        cache.pop();
    }
}
