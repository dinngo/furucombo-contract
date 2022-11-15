// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./Utils.sol";
import "./Foo.sol";
import "./FooHandler.sol";
import "contracts/Proxy.sol";
import "contracts/Registry.sol";
import "contracts/FeeRuleRegistry.sol";

contract ProxyTest is Utils {
    bytes32 private constant PARAMS_MASK =
        0x0000000000000000000000000000000000000000000000000000000000000001;

    uint256 private constant PARAMS_MAX_COUNT = 10;

    Proxy private _proxy;
    Registry private _registry;
    FeeRuleRegistry private _feeRuleRegistry;
    Foo private _foo;
    FooHandler private _fooHandler;

    address private _user;
    address private _collector;

    function setUp() external {
        _user = _getSigner("user");
        _collector = _getSigner("collector");
        _registry = new Registry();
        _feeRuleRegistry = new FeeRuleRegistry(1, _collector);
        _proxy = new Proxy(address(_registry), address(_feeRuleRegistry));
        _foo = new Foo();
        _fooHandler = new FooHandler();

        // register
        bytes32 info =
            0x000000000000000000000000000000000000000000000066757A7A5F74657374; // Hash of fuzz_info
        _registry.register(address(_fooHandler), info);
    }

    function testReplaceParameterLocationWithLocalStack(uint256 paramLoc)
        external
    {
        // Step 1: Bound a random parameter location
        // The max value is derived from 1's in each bit except the rightest bit (2046 = 1024 + 512 + 256 + 128 + 64 + 32 + 16 + 8 + 4 + 2)
        paramLoc = bound(paramLoc, 2, 2046);

        // Step 2: Ensure we don't replace the first input parameter of the first cube
        // Turn the rightest bit to be 0 = do not replace 1st 32 bytes parameter data
        if (paramLoc % 2 != 0) {
            --paramLoc;
        }

        // Step 3: Shift the parameter location to the correct range / bits
        bytes32 paramLocBytes32 = bytes32(paramLoc);
        bytes32 paramLocBytes32Shifted = paramLocBytes32 << (22 * 8);

        // Step 4: Generate reference location (gen ff by minus 1)
        // Use localStack[0] to replace all the other input parameters
        uint256 numOfOne = _getNumOfOne(paramLocBytes32Shifted);
        uint256 v = 1;
        bytes32 ref = bytes32(uint256(bytes32(v) << ((22 - numOfOne) * 8)) - 1);

        // Step 5: Prepare tos, configs and datas
        bytes32 dynamicParam;
        address[] memory tos = new address[](2);
        tos[0] = tos[1] = address(_fooHandler);

        bytes32[] memory configs = new bytes32[](2);
        configs[
            0
        ] = 0x0001000000000000000000000000000000000000000000000000000000000000;
        configs[
            1
        ] = 0x0100000000000000000000000000000000000000000000000000000000000000;
        configs[1] = configs[1] | paramLocBytes32Shifted | ref; // Assemble config

        bytes[] memory datas = new bytes[](2);
        {
            datas[0] = abi.encodeWithSelector(
                _fooHandler.bar.selector,
                address(_foo)
            );
            // Replace params with 100% stack values
            datas[1] = abi.encodeWithSelector(
                _fooHandler.bar10.selector,
                address(_foo),
                dynamicParam,
                dynamicParam,
                dynamicParam,
                dynamicParam,
                dynamicParam,
                dynamicParam,
                dynamicParam,
                dynamicParam,
                dynamicParam,
                dynamicParam
            );
        }

        uint256[] memory ruleIndexes;

        // Step 6: Execution
        _proxy.batchExec(tos, configs, datas, ruleIndexes);

        // Step 7: Assert
        bytes32 paramLocBytes32Dup = paramLocBytes32;
        // Parse the index from parameter location in loop
        for (uint256 i = 0; i <= PARAMS_MAX_COUNT; i++) {
            // The rightest bit of paramLocBytes32Dup must be 0
            if (paramLocBytes32Dup & PARAMS_MASK != 0) {
                assertEq(_foo.bValues(i - 1), _foo.bar());
            }
            paramLocBytes32Dup = paramLocBytes32Dup >> 1;
        }
    }

    function testReplaceParameterLocationWithPercentagedLocalStack(
        uint256 dynamicParam
    ) external {
        dynamicParam = bound(dynamicParam, 1, 1 ether - 1);
        uint256 r = _foo.barUint();
        address[] memory tos = new address[](2);
        tos[0] = tos[1] = address(_fooHandler);

        bytes32[] memory configs = new bytes32[](2);
        configs[
            0
        ] = 0x0001000000000000000000000000000000000000000000000000000000000000;
        configs[
            1
        ] = 0x0100000000000000000200ffffffffffffffffffffffffffffffffffffffffff;

        bytes[] memory datas = new bytes[](2);
        {
            datas[0] = abi.encodeWithSelector(
                _fooHandler.barUint.selector,
                address(_foo)
            );
            // Replace 2nd param with stack value * dynamicParam
            datas[1] = abi.encodeWithSelector(
                _fooHandler.barUint1.selector,
                address(_foo),
                dynamicParam
            );
        }

        uint256[] memory ruleIndexes;

        // Execution
        _proxy.batchExec(tos, configs, datas, ruleIndexes);

        // Assert
        assertEq(_foo.nValue(), (r * dynamicParam) / 1 ether);
    }

    function _getNumOfOne(bytes32 input) internal pure returns (uint256 num) {
        for (uint256 i = 0; i < 256; i++) {
            if (input & PARAMS_MASK != 0) {
                num++;
            }
            input = input >> 1;
        }
    }
}
