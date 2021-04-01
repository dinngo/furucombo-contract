pragma experimental ABIEncoderV2;

import "./DummyERC20A.sol";

interface IERC20WithDummyFunctionality {
    function transfer(address to, uint amt) external;
    function transferFrom(address from, address to, uint amt) external;
    function balanceOf(address who) external returns (uint);
    function allowance(address a, address b) external returns (uint);
    function havocMe(address proxy) external;
    function havocMeEth() external;
}

interface Nothing {
    function nop() external payable;
}

interface WithEthAddress {
    function ETH_ADDRESS() external returns (address);
}

// used to summarize different functions
contract Summary {

    function getEthAddress(address handler) external returns (address) {
        // either the handler defines a ETH_ADDRESS function or it does not. If it does not then just return address(0)
        address eth = address(0);
        try WithEthAddress(handler).ETH_ADDRESS() returns (address x) {
            eth = x;
        } catch {
            eth = address(0);
        }
        return eth;
    }

    IERC20WithDummyFunctionality public erc20A;
    IERC20WithDummyFunctionality public erc20B;
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
    address[] delegated;
    function lenDelegated() external returns (uint256) { return delegated.length; }
    function checkDelegated(address allowed) external returns (bool) {
        for (uint i = 0 ; i < delegated.length; i++) {
            if (delegated[i] != allowed) {
                return false;
            }
        }

        return true;
    }

    function execute(address a, bytes calldata b) external payable returns (bytes32) {
        delegated.push(a);
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
    // erc20A is the underlying and erc20B is the AToken
    function deposit(address r, uint a, uint16 c) external payable {
        consumedToken = r;
        shouldBeConsumedAmount = a;
        IERC20WithDummyFunctionality(r).transferFrom(msg.sender, address(this), a);
        require (r == address(erc20A));
        // here erc20B is the "aToken"
        generatedToken = address(erc20B);
        erc20B.transferFrom(address(0), msg.sender, someAmount); // "minting"
    }

    function redeem(uint amount) external {
        consumedToken = address(erc20B);
        shouldBeConsumedAmount = amount;
        generatedToken = address(erc20A);
        erc20B.transferFrom(msg.sender, address(0), amount); // "burning"
        erc20A.transferFrom(address(this), msg.sender, someAmount);
    }

    function flashLoan(address receiver, address reserve, uint256 amount, bytes calldata params) external {
        havocDummyToken();
    }

    // for HAaveProtocol2
    // erc20A is the underlying and erc20B is the AToken
    function borrow(
        address asset,
        uint256 amount,
        uint256 interestRateMode,
        uint16 referralCode,
        address onBehalfOf
    ) external {
        generatedToken = asset;
        IERC20WithDummyFunctionality(asset).transfer(msg.sender, amount);
    }

    function deposit(
        address asset,
        uint256 amount,
        address onBehalfOf,
        uint16 referralCode
    ) external {
        consumedToken = asset;
        require (asset == address(erc20A));
        generatedToken = address(erc20B);
        IERC20WithDummyFunctionality(asset).transferFrom(msg.sender, address(this), amount);
        erc20B.transferFrom(address(0), msg.sender, amount); // "minting"
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

    // HOneInchExchange
    struct SwapDescription {
        address srcToken;
        address dstToken;
        address srcReceiver;
        address dstReceiver;
        uint256 amount;
        uint256 minReturnAmount;
        uint256 guaranteedAmount;
        uint256 flags;
        address referrer;
        bytes permit;
    }
    struct CallDescription {
        uint256 targetWithMandatory;
        uint256 gasLimit;
        uint256 value;
        bytes data;
    }

    function swap(address a, SwapDescription memory desc, CallDescription[] calldata cd) external returns (uint256) {
        consumedToken = desc.srcToken;
        generatedToken = desc.dstToken;
        shouldBeConsumedAmount = desc.amount;
        IERC20WithDummyFunctionality(desc.srcToken).transferFrom(msg.sender, address(this), desc.amount);
        IERC20WithDummyFunctionality(desc.dstToken).transfer(msg.sender, someAmount);
        return executeRetUint256;
    }

    address public consumedToken;
    address public generatedToken;
    uint public shouldBeConsumedAmount;
    function getBalance(address token, address who) public returns (uint) { return IERC20WithDummyFunctionality(token).balanceOf(who); }
}