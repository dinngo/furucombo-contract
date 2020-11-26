pragma solidity ^0.6.0;

library LibParam {
    bytes32 public constant STATIC_MASK =
        0x0100000000000000000000000000000000000000000000000000000000000000;
    bytes32 public constant REFERENCED_MASK =
        0x0200000000000000000000000000000000000000000000000000000000000000;
    bytes32 public constant PARAMS_MASK =
        0x0000000000000000000000000000000000000000000000000000000000000001;
    bytes32 public constant REFS_MASK =
        0x00000000000000000000000000000000000000000000000000000000000000FF;

    uint256 public constant REFS_LIMIT = 23;
    uint256 public constant PARAMS_SIZE_LIMIT = 64;

    function isStatic(bytes32 conf) internal pure returns (bool) {
        if (conf & STATIC_MASK == 0) return true;
        else return false;
    }

    function isReferenced(bytes32 conf) internal pure returns (bool) {
        if (conf & REFERENCED_MASK == 0) return false;
        else return true;
    }

    function getParams(bytes32 conf)
        internal
        pure
        returns (uint256[] memory refs, uint256[] memory params)
    {
        require(!isStatic(conf), "Static params");
        uint256 n = 0;
        while (conf & REFS_MASK == REFS_MASK && n < PARAMS_SIZE_LIMIT) {
            n++;
            conf = conf >> 8;
        }
        n = REFS_LIMIT - n;
        require(n > 0, "No dynamic param");
        refs = new uint256[](n);
        params = new uint256[](n);
        for (uint256 i = 0; i < n; i++) {
            refs[i] = uint256(conf & REFS_MASK);
            conf = conf >> 8;
        }
        uint256 i = 0;
        for (uint256 k = 0; k < PARAMS_SIZE_LIMIT && i < n; k++) {
            if (conf & PARAMS_MASK != 0) {
                params[i] = k * 32 + 4;
                i++;
            }
            conf = conf >> 1;
        }
    }
}
