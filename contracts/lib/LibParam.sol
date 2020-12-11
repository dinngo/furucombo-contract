pragma solidity ^0.6.0;

library LibParam {
    bytes32 private constant STATIC_MASK =
        0x0100000000000000000000000000000000000000000000000000000000000000;
    bytes32 private constant PARAMS_MASK =
        0x0000000000000000000000000000000000000000000000000000000000000001;
    bytes32 private constant REFS_MASK =
        0x00000000000000000000000000000000000000000000000000000000000000FF;
    bytes32 private constant RETURN_NUM_MASK =
        0x00FF000000000000000000000000000000000000000000000000000000000000;

    uint256 private constant REFS_LIMIT = 22;
    uint256 private constant PARAMS_SIZE_LIMIT = 64;
    uint256 private constant RETURN_NUM_OFFSET = 240;

    function isStatic(bytes32 conf) internal pure returns (bool) {
        if (conf & STATIC_MASK == 0) return true;
        else return false;
    }

    function isReferenced(bytes32 conf) internal pure returns (bool) {
        if (getReturnNum(conf) == 0) return false;
        else return true;
    }

    function getReturnNum(bytes32 conf) internal pure returns (uint256 num) {
        bytes32 temp = (conf & RETURN_NUM_MASK) >> RETURN_NUM_OFFSET;
        num = uint256(temp);
    }

    function getParams(bytes32 conf)
        internal
        pure
        returns (uint256[] memory refs, uint256[] memory params)
    {
        require(!isStatic(conf), "Static params");
        uint256 n = 0;
        while (conf & REFS_MASK == REFS_MASK && n < REFS_LIMIT) {
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
        for (uint256 k = 0; k < PARAMS_SIZE_LIMIT; k++) {
            if (conf & PARAMS_MASK != 0) {
                require(i < n, "Location count exceeds ref count");
                params[i] = k * 32 + 4;
                i++;
            }
            conf = conf >> 1;
        }
        require(i == n, "Location count and ref count not match");
    }
}
