pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

contract Proxy {
    function _exec(address to, bytes memory data) internal returns (bytes memory result) {
        assembly {
            let succeeded := delegatecall(sub(gas, 0), to, add(data, 0x20), mload(data), 0, 0)
            let size := returndatasize

            result := mload(0x40)
            mstore(0x40, add(result, and(add(add(size, 0x20), 0x1f), not(0x1f))))
            mstore(result, size)
            returndatacopy(add(result, 0x20), 0, size)

            switch iszero(succeeded)
            case 1 {
                revert(add(result, 0x20), size)
            }
        }
    }

    function batchExec(address[] memory tos, bytes[] memory datas) {
        for (uint256 i = 0; i < tos.length; i++) {
            exec(tos[i], datas[i]);
        }
    }
}
