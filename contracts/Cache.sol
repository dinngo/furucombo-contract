pragma solidity ^0.5.0;

import "./lib/LibCache.sol";


contract Cache {
    using LibCache for bytes32[];

    bytes32[] cache;

    modifier isCacheEmpty() {
        require(cache.length == 0, "Cache not empty");
        _;
    }
}
