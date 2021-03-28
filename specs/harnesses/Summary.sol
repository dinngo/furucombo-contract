import "./DummyERC20A.sol";

interface Nothing {
    function nop() external payable;
}

// used to summarize different functions
contract Summary {

    DummyERC20A erc20A;
    bytes32 executeRet;
    uint256 executeRetUint256;

    address faucet;
    uint someAmount;

    function havocDummyToken() private {
        if (erc20A.allowance(msg.sender, address(this)) > 0) {
            // preserves proxy eth balance if no eth passed
            if (msg.value == 0) {
                erc20A.havocMe(msg.sender);
            } else {
                erc20A.havocMeEth();
            }
        } else {
            // simulate receiving tokens
            erc20A.transferFrom(faucet, msg.sender, someAmount);
        }
    }

    // for HMaker, HSCompound
    function execute(address a, bytes calldata b) external payable returns (bytes32) {
        havocDummyToken();
        return executeRet;
    }

    address _owner;
    function owner() external returns (address) {
        return _owner;
    }

    function claimComp(address a) external {
        havocDummyToken();
    }

    // for HAaveProtocol
    function deposit(address r, uint a, uint16 c) external payable {
        havocDummyToken();
    }

    function redeem(uint amount) external {
        havocDummyToken();
    }

    function flashLoan(address receiver, address reserve, uint256 amount, bytes calldata params) external {
        havocDummyToken();
    }

    // for HAaveProtocol2
    function borrow(
        address asset,
        uint256 amount,
        uint256 interestRateMode,
        uint16 referralCode,
        address onBehalfOf
    ) external {
        havocDummyToken();
    }

    function deposit(
        address asset,
        uint256 amount,
        address onBehalfOf,
        uint16 referralCode
    ) external {
        havocDummyToken();
    }

    function flashLoan(
        address receiverAddress,
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata modes,
        address onBehalfOf,
        bytes calldata params,
        uint16 referralCode
    ) external {
        havocDummyToken();
    }

    function repay(
        address asset,
        uint256 amount,
        uint256 rateMode,
        address onBehalfOf
    ) external returns (uint256) {
        erc20A.transferFrom(onBehalfOf,address(this),amount);
        return executeRetUint256;
    }

    function withdraw(
        address asset,
        uint256 amount,
        address to
    ) external returns (uint256) {
        havocDummyToken();
        return executeRetUint256;
    }

    // IWETH9
    function withdraw(uint256 amt) external {
        Nothing(msg.sender).nop{value:amt}();
    }
}