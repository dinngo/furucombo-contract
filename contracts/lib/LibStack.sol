// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../Config.sol";

library LibStack {
    function setAddress(bytes32[] storage _stack, address _input) internal {
        _stack.push(bytes32(uint256(uint160(_input))));
    }

    function set(bytes32[] storage _stack, bytes32 _input) internal {
        _stack.push(_input);
    }

    function setHandlerType(bytes32[] storage _stack, Config.HandlerType _input)
        internal
    {
        _stack.push(bytes12(uint96(_input)));
    }

    function getAddress(bytes32[] storage _stack)
        internal
        returns (address ret)
    {
        ret = address(uint160(uint256(peek(_stack, 1))));
        _stack.pop();
    }

    function getSig(bytes32[] storage _stack) internal returns (bytes4 ret) {
        ret = bytes4(peek(_stack, 1));
        _stack.pop();
    }

    function get(bytes32[] storage _stack) internal returns (bytes32 ret) {
        ret = peek(_stack, 1);
        _stack.pop();
    }

    function peek(bytes32[] storage _stack, uint256 _elementsFromTop)
        internal
        view
        returns (bytes32 ret)
    {
        require(
            _stack.length >= _elementsFromTop,
            "not enough elements in stack"
        );
        ret = _stack[_stack.length - _elementsFromTop];
    }
}
