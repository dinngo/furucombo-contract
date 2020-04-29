pragma solidity ^0.5.0;

import "../handlers/HandlerBase.sol";


interface IFoo {
    function bar(uint256 a) external returns (uint256 result);
}


interface IFooFactory {
    function addressOf(uint256 index) external view returns (address result);

    function createFoo() external;
}


contract FooHandler is HandlerBase {
    function getFooFactory() public pure returns (address target) {
        return 0xb9A219631Aed55eBC3D998f17C3840B7eC39C0cc;
    }

    function getFoo(uint256 index) public view returns (address target) {
        return IFooFactory(getFooFactory()).addressOf(index);
    }

    function bar(uint256 index, uint256 a) public returns (uint256 result) {
        address target = getFoo(index);
        return IFoo(target).bar(a);
    }
}
