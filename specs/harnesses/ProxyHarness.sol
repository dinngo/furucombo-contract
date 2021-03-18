pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import "../../contracts/Proxy.sol";

contract ProxyHarness is Proxy {

    constructor(address registry) public Proxy(registry) {}

    function getSlot(uint s) external view returns (uint x) {
        assembly {
            x := sload(s)
        }
    }

    function getStackLength() external view returns (uint) {
        return stack.length;
    }

    // simplifying summaries of certain functions in proxy
    function _parse(
        bytes32[2] memory localStack,
        bytes memory ret,
        uint256 index
    ) internal pure override returns (uint256) {
        uint sz = ret.length/32;
        uint newIndex = index+sz;
        require(newIndex <= 2);

        for (uint256 i = 0 ; i < sz ; i++) {
            localStack[index+i*32] = ret[i*32]; 
        }

        return newIndex;
    } 

    function _trim(
        bytes memory data,
        bytes32 config,
        bytes32[2] memory localStack,
        uint256 index
    ) internal pure override {
        // no-op
    }

    address dummy;

    function _exec(address _to, bytes memory _data)
        internal override
        returns (bytes memory result) {
            require(_isValidHandler(_to), "Invalid handler");
            _addCubeCounter();
            bool success;
            (success, result) = dummy.call(abi.encodeWithSelector(0x12345678));
        }

    // should be optional once issue is resolved
    function _execs(
        address[] memory tos,
        bytes32[] memory configs,
        bytes[] memory datas
    ) internal override {
        bytes32[2] memory localStack;
        uint256 index = 0;
        require (tos.length == 1);
        require (configs.length == 1);
        require (datas.length == 1);
        address to = tos[0];
        bytes32 config = configs[0];
        bytes memory data = datas[0]; 
        if (!config.isStatic()) {
            // If so, trim the exectution data base on the configuration and stack content
            _trim(data, config, localStack, index);
        }
        // Check if the output will be referenced afterwards
        if (config.isReferenced()) {
            // If so, parse the output and place it into local stack
            uint256 num = config.getReturnNum();
            uint256 newIndex =
                _parse(localStack, _exec(to, data), index);
            require(
                newIndex == index + num,
                "Return num and parsed return num not matched"
            );
            index = newIndex;
        } else {
            _exec(to, data);
        }
        // Setup the process to be triggered in the post-process phase
        _setPostProcess(to);
    }

    // internal-to-public
    function getSender() public returns (address) { return _getSender(); }

}