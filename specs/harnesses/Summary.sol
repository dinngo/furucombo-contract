import "./DummyERC20A.sol";

// used to summarize different functions
contract Summary {

    DummyERC20A erc20A;
    bytes32 executeRet;
    
    address faucet;
    uint someAmount;

    function havocDummyToken() private {
        if (erc20A.allowance(msg.sender, address(this)) > 0) {
            erc20A.havocMe();
        } else {
            // simulate receiving tokens
            erc20A.transferFrom(faucet, msg.sender, someAmount);
        }
    }
    // for HMaker
    function execute(address a, bytes calldata b) external payable returns (bytes32) {
        havocDummyToken();
        return executeRet;
    }

    // for HAaveProtocol
    function deposit(address r, uint a, uint16 c) external payable {
        havocDummyToken();
    }
}