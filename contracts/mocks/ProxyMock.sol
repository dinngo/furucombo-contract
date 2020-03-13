pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "../Proxy.sol";

contract ProxyMock is Proxy {
    function execMock(address to, bytes memory data) public returns (bytes memory result) {
        return _exec(to, data);
    }
}
