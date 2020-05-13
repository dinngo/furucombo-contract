pragma solidity ^0.5.0;

import "../Cache.sol";
import "../Config.sol";


contract HandlerBase is Cache, Config {
    function postProcess() external payable {
        revert("Invalid post process");
    }

    function _updateNoop() internal {
        cache.set(bytes32(uint256(HandlerType.Noop)));
    }

    function _updateToken(address token) internal {
        cache.setAddress(token);
        cache.set(bytes32(uint256(HandlerType.Token)));
    }

    function _updatePostProcess(bytes32[] memory params) internal {
        for (uint256 i = params.length; i > 0; i--) {
            cache.set(params[i - 1]);
        }
        cache.set(msg.sig);
    }
}
