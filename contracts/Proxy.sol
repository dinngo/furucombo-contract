pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "./interface/IRegistry.sol";
import "./Cache.sol";
import "./Config.sol";


contract Proxy is Cache, Config {
    using Address for address;

    // keccak256 hash of "furucombo.handler.registry"
    bytes32 private constant HANDLER_REGISTRY = 0x6874162fd62902201ea0f4bf541086067b3b88bd802fac9e150fd2d1db584e19;

    constructor(address registry) public {
        bytes32 slot = HANDLER_REGISTRY;
        assembly {
            sstore(slot, registry)
        }
    }

    function() external payable {
        require(Address.isContract(msg.sender), "Not allowed from EOA");

        if (msg.data.length != 0) {
            require(_isValid(msg.sender), "Invalid caller");

            address target = address(
                bytes20(IRegistry(_getRegistry()).getInfo(msg.sender))
            );
            _exec(target, msg.data);
        }
    }

    function batchExec(address[] memory tos, bytes[] memory datas)
        public
        payable
    {
        _preProcess();
        _execs(tos, datas);
        _postProcess();
    }

    function execs(address[] memory tos, bytes[] memory datas) public payable {
        require(msg.sender == address(this), "Does not allow external calls");
        _execs(tos, datas);
    }

    function _execs(address[] memory tos, bytes[] memory datas) internal {
        require(
            tos.length == datas.length,
            "Tos and datas length inconsistent"
        );
        for (uint256 i = 0; i < tos.length; i++) {
            _exec(tos[i], datas[i]);
            _setPostProcess(tos[i]);
        }
    }

    function _exec(address _to, bytes memory _data)
        internal
        returns (bytes memory result)
    {
        require(_isValid(_to), "Invalid handler");
        assembly {
            let succeeded := delegatecall(
                sub(gas, 5000),
                _to,
                add(_data, 0x20),
                mload(_data),
                0,
                0
            )
            let size := returndatasize

            result := mload(0x40)
            mstore(
                0x40,
                add(result, and(add(add(size, 0x20), 0x1f), not(0x1f)))
            )
            mstore(result, size)
            returndatacopy(add(result, 0x20), 0, size)

            switch iszero(succeeded)
                case 1 {
                    revert(add(result, 0x20), size)
                }
        }
    }

    function _setPostProcess(address _to) internal {
        if (cache.length == 0) return;
        else if (cache.peek() == bytes32(uint256(HandlerType.Custom))) {
            cache.pop();
            cache.push(bytes20(_to));
        }
    }

    function _preProcess() internal isCacheEmpty {}

    function _postProcess() internal {
        // Token involved should be returned to user
        while (cache.length > 0) {
            address to = cache.getAddress();
            if (to == address(0)) {
                address token = cache.getAddress();
                uint256 amount = IERC20(token).balanceOf(address(this));
                if (amount > 0) IERC20(token).transfer(msg.sender, amount);
            } else _exec(to, abi.encodeWithSelector(POSTPROCESS_SIG));
        }

        // Balance should also be returned to user

        uint256 amount = address(this).balance;
        if (amount > 0) msg.sender.transfer(amount);
    }

    function _getRegistry() internal view returns (address registry) {
        bytes32 slot = HANDLER_REGISTRY;
        assembly {
            registry := sload(slot)
        }
    }

    function _isValid(address handler) internal view returns (bool result) {
        return IRegistry(_getRegistry()).isValid(handler);
    }
}
