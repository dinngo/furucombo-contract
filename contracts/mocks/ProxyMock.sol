pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "../Proxy.sol";

contract ProxyMock is Proxy {
    function execMock(address to, bytes memory data) public payable returns (bytes memory result) {
        result = _exec(to, data);
        _postProcess();
        return result;
    }
}
