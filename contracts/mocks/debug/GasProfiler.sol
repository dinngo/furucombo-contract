pragma solidity ^0.5.0;

contract GasProfiler {
    // keccak256 hash of "gas.profiler.base"
    bytes32 private constant GAS_BASE =
        0x37698e52cd5639897dae03c485a7870bceb6876f0e950fc063664398d5580c0c;

    event DeltaGas(bytes32 tag, uint256 gas);
    event GetGas(bytes32 tag, uint256 gas);

    function _setBase() internal {
        bytes32 slot = GAS_BASE;
        assembly {
            sstore(slot, sub(gas(), 20003))
        }
    }

    function _getBase() internal returns (uint256 base) {
        bytes32 slot = GAS_BASE;
        assembly {
            base := sload(slot)
        }
    }

    function _deltaGas(bytes32 tag) internal {
        emit DeltaGas(tag, _getBase() - gasleft());
        _setBase();
    }

    function _getGas(bytes32 tag) internal {
        emit GetGas(tag, _getBase());
        _setBase();
    }
}
