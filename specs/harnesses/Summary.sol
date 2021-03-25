import "./DummyERC20A.sol";

// used to summarize different functions
contract Summary {

    DummyERC20A erc20A;
    bytes32 executeRet;
    // for HMaker
    function execute(address a, bytes calldata b) external payable returns (bytes32) {
        if (erc20A.allowance(msg.sender, address(this)) > 0) {
            erc20A.havocMe();
        }
        return executeRet;
    }
}