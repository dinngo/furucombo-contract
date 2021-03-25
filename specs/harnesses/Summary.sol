import "./DummyERC20A.sol";

// used to summarize different functions
contract Summary {

    DummyERC20A erc20A;
    bytes32 executeRet;
    function execute(address a, bytes calldata b) external payable returns (bytes32) {
        erc20A.havocMe();
        return executeRet;
    }
}