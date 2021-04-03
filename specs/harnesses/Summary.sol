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

interface IMakerGemJoin {
    function gem() external returns(address);
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
    uint someAmount2;

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

    /* Desired proxy.execute() */
    /*function execute(address a, bytes calldata b) external payable returns (bytes32) {
        delegated.push(a);
        (bool success, bytes memory data) = address(this).call(b);
        require(success);
        return executeRet;
    }*/

    function freeETH(address cdpManager,address ethJoin,uint256 cdp,uint256 wad) external payable {
        Nothing(msg.sender).nop{value:wad}();
    }
    function freeGem(address cdpManager,address gemJoin,uint256 cdp,uint256 wad) external payable {
        generatedToken = IMakerGemJoin(gemJoin).gem();
        IERC20WithDummyFunctionality(generatedToken).transfer(msg.sender, wad);
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
        require (a == 0 || someAmount > 0); // this may actually not hold in reality, but depends on Aave code
        erc20B.transferFrom(address(0), msg.sender, someAmount); // "minting"
    }

    function redeem(uint amount) external {
        consumedToken = address(erc20B);
        shouldBeConsumedAmount = amount;
        generatedToken = address(erc20A);
        erc20B.transferFrom(msg.sender, address(0), amount); // "burning"
        require (amount == 0 || someAmount > 0); // this may actually not hold in reality, but depends on Aave code
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
    function deposit() external payable {
        // erc20A will be the "weth" token here
        erc20A.transferFrom(address(0), msg.sender, msg.value);
    }
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

    // HUniswap
    // the exchange is also the LP token. Applicable to HUniswapV2 and HSushiswap
    function add(uint a, uint b) internal pure returns (uint256) {
        uint c = a +b;
        require (c >= a);
        return c;
    }
    function sub(uint a, uint b) internal pure returns (uint256) {
        require (a>=b);
        return a-b;
    }

    mapping (address => uint) public balanceOf;
    mapping (address => mapping (address => uint)) public allowance;
    uint public totalSupply;
    function approve(address spender, uint amount) public returns (bool) { allowance[msg.sender][spender] = amount; return true; }
    function transfer(address recipient, uint256 amount) public returns (bool) {
        balanceOf[msg.sender] = sub(balanceOf[msg.sender], amount);
        balanceOf[recipient] = add(balanceOf[recipient], amount);
        return true;
    }
    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) public returns (bool) {
        balanceOf[sender] = sub(balanceOf[sender], amount);
        balanceOf[recipient] = add(balanceOf[recipient], amount);
        allowance[sender][msg.sender] = sub(allowance[sender][msg.sender], amount);
        return true;
    }

    // we assume the pair is erc20A <> "eth"
    function ethToTokenSwapInput(uint256 min_tokens, uint256 deadline) external payable returns (uint256  tokens_bought) {
        generatedToken = address(erc20A);
        erc20A.transfer(msg.sender, someAmount);
        tokens_bought = someAmount;
    }
    function ethToTokenSwapOutput(uint256 tokens_bought, uint256 deadline) external payable returns (uint256  eth_sold) {
        generatedToken = address(erc20A);
        erc20A.transfer(msg.sender, tokens_bought);
        eth_sold = msg.value;
    }
    function addLiquidity(uint256 min_liquidity, uint256 max_tokens, uint256 deadline) external payable returns (uint256) {
        // this will be the LP token
        consumedToken = address(erc20A);
        require (address(erc20A) != address(this)); // LP token is not exchanged token
        shouldBeConsumedAmount = someAmount2;
        // someAmount is how much we get
        // someAmount2 is how much we give in tokens (msg.value is how much we give in ETH)
        require (someAmount >= min_liquidity && min_liquidity > 0);
        generatedToken = address(this);
        erc20A.transferFrom(msg.sender, address(this), someAmount2);
        transferFrom(address(0), msg.sender, someAmount);
        return someAmount;
    }
    function tokenToEthSwapInput(uint256 tokens_sold, uint256 min_eth, uint256 deadline) external returns (uint256  eth_bought) {
        shouldBeConsumedAmount = tokens_sold;
        consumedToken = address(erc20A);
        erc20A.transferFrom(msg.sender, address(this), tokens_sold);
        //require (someAmount > min_eth);
        eth_bought = someAmount;
        Nothing(msg.sender).nop{value:someAmount}();
    }
    function tokenToEthSwapOutput(uint256 eth_bought, uint256 max_tokens, uint256 deadline) external returns (uint256  tokens_sold) {
        consumedToken = address(erc20A);
        shouldBeConsumedAmount = someAmount;
        require (someAmount <= max_tokens);
        erc20A.transferFrom(msg.sender, address(this), someAmount);
        tokens_sold = someAmount;
        Nothing(msg.sender).nop{value:eth_bought}();
    }
    function removeLiquidity(uint256 amount, uint256 min_eth, uint256 min_tokens, uint256 deadline) external returns (uint256, uint256) {
        // this will be the LP token
        consumedToken = address(this);
        shouldBeConsumedAmount = amount;
        transferFrom(msg.sender, address(0), amount);
        // transfer someAmount of eth and someAmount2 of tokens
        erc20A.transfer(msg.sender, someAmount2);
        Nothing(msg.sender).nop{value:someAmount}();
        return (someAmount, someAmount2); // ordering is eth, token
    }
    function tokenToTokenSwapOutput(uint256 tokens_bought, uint256 max_tokens_sold, uint256 max_eth_sold, uint256 deadline, address token_addr) external returns (uint256  tokens_sold) {
        require(tokens_bought > 0); // https://github.com/Uniswap/uniswap-v1/blob/c10c08d81d6114f694baa8bd32f555a40f6264da/contracts/uniswap_exchange.vy#L313
        shouldBeConsumedAmount = someAmount;
        consumedToken = address(erc20A);
        require (address(erc20A) != address(this)); // LP token is not the exchanged token
        generatedToken = token_addr; // can token_addr be the LP token? probably not https://github.com/Uniswap/uniswap-v1/blob/c10c08d81d6114f694baa8bd32f555a40f6264da/contracts/uniswap_exchange.vy#L314
        require (token_addr != address(this));
        tokens_sold = someAmount;
        erc20A.transferFrom(msg.sender, address(this), someAmount);
        require(token_addr == address(erc20B)); // It doesn't make sense to have a pair token<>token
        erc20B.transfer(msg.sender, tokens_bought);
    }
    function tokenToTokenSwapInput(uint256 tokens_sold, uint256 min_tokens_bought, uint256 min_eth_bought, uint256 deadline, address token_addr) external returns (uint256  tokens_bought) {
        shouldBeConsumedAmount = tokens_sold;
        consumedToken = address(erc20A);
        require (address(erc20A) != address(this)); // LP token is not the exchanged token
        generatedToken = token_addr;
        // token_addr is not the LP token https://github.com/Uniswap/uniswap-v1/blob/c10c08d81d6114f694baa8bd32f555a40f6264da/contracts/uniswap_exchange.vy#L273
        require (token_addr != address(this));
        erc20A.transferFrom(msg.sender, address(this), tokens_sold);
        require(token_addr == address(erc20B)); // It doesn't make sense to have a pair token<>token
        tokens_bought = someAmount;
        require (tokens_bought > min_tokens_bought && min_tokens_bought > 0); // based on https://github.com/Uniswap/uniswap-v1/blob/c10c08d81d6114f694baa8bd32f555a40f6264da/contracts/uniswap_exchange.vy#L272
        erc20B.transfer(msg.sender, someAmount);
    }

    // HUniswapV2, HSushiSwap
    function addLiquidity(
        address tokenA,
        address tokenB,
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    )
        external
        returns (
            uint256 amountA,
            uint256 amountB,
            uint256 liquidity
        ) {
            require (tokenA != tokenB && tokenA != address(this) && tokenB != address(this));
            require (amountAMin > 0 && amountBMin > 0);
            uint amountA = amountAMin;
            uint amountB = amountBMin;
            IERC20WithDummyFunctionality(tokenA).transferFrom(msg.sender, address(this), amountA);
            IERC20WithDummyFunctionality(tokenB).transferFrom(msg.sender, address(this), amountB);
            transferFrom(address(0), to, someAmount);
            consumedToken = tokenA;
            shouldBeConsumedAmount = amountA;
            generatedToken = address(this);
            require(someAmount > 0);
            liquidity = someAmount;
        }

    function addLiquidityETH(
        address token,
        uint256 amountTokenDesired,
        uint256 amountTokenMin,
        uint256 amountETHMin,
        address to,
        uint256 deadline
    )
        external
        payable
        returns (
            uint256 amountToken,
            uint256 amountETH,
            uint256 liquidity
        ) {
            require (token != address(this));
            consumedToken = token;
            require (amountTokenMin > 0);
            amountToken = amountTokenMin;
            shouldBeConsumedAmount = amountTokenMin;
            generatedToken = address(this);
            IERC20WithDummyFunctionality(token).transferFrom(msg.sender, address(this), amountToken);
            amountETH = msg.value;
            transferFrom(address(0), to, someAmount);
            require(someAmount > 0);
            liquidity = someAmount;
        }

    function removeLiquidity(
        address tokenA,
        address tokenB,
        uint256 liquidity,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    ) external returns (uint256 amountA, uint256 amountB) {
        require (tokenA != tokenB && tokenA != address(this) && tokenB != address(this));
        require(amountAMin > 0 && amountBMin > 0);
        consumedToken = address(this);
        shouldBeConsumedAmount = liquidity;
        generatedToken = tokenA;
        transferFrom(msg.sender, address(0), liquidity);
        IERC20WithDummyFunctionality(tokenA).transfer(to, amountAMin);
        IERC20WithDummyFunctionality(tokenB).transfer(to, amountBMin);
        return (amountAMin, amountBMin);
    }

    function removeLiquidityETH(
        address token,
        uint256 liquidity,
        uint256 amountTokenMin,
        uint256 amountETHMin,
        address to,
        uint256 deadline
    ) external returns (uint256 amountToken, uint256 amountETH) {
        require (token != address(this));
        require(amountTokenMin > 0);
        consumedToken = address(this);
        shouldBeConsumedAmount = liquidity;
        generatedToken = token;
        transferFrom(msg.sender, address(0), liquidity);
        IERC20WithDummyFunctionality(token).transfer(to, amountTokenMin);
        Nothing(to).nop{value:amountETHMin}();
        return (amountTokenMin,amountETHMin);
    }

    uint[] someArr;
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts) {
        require (amountIn > 0 && amountOutMin > 0);
        require (path.length == 2);
        require (path[0] != address(this) && path[1] != address(this));
        consumedToken = path[0];
        generatedToken = path[1];
        require (consumedToken != generatedToken);
        shouldBeConsumedAmount = amountIn;
        IERC20WithDummyFunctionality(consumedToken).transferFrom(msg.sender, address(this), amountIn);
        IERC20WithDummyFunctionality(generatedToken).transfer(to, amountOutMin);
        return someArr;
    }

    function swapTokensForExactTokens(
        uint256 amountOut,
        uint256 amountInMax,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts) {
        require (amountInMax > 0 && amountOut > 0);
        require (path.length == 2);
        require (path[0] != address(this) && path[1] != address(this));
        consumedToken = path[0];
        generatedToken = path[1];
        require (consumedToken != generatedToken);
        shouldBeConsumedAmount = amountInMax;
        IERC20WithDummyFunctionality(consumedToken).transferFrom(msg.sender, address(this), amountInMax);
        IERC20WithDummyFunctionality(generatedToken).transfer(to, amountOut);
        return someArr;
    }

    function swapExactETHForTokens(
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external payable returns (uint256[] memory amounts) {
        require (amountOutMin > 0);
        require(path.length == 2);
        require (path[0] != address(this) && path[1] != address(this));
        generatedToken = path[1];
        IERC20WithDummyFunctionality(generatedToken).transfer(to, amountOutMin);
        return someArr;
    }

    function swapTokensForExactETH(
        uint256 amountOut,
        uint256 amountInMax,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts) {
        require (amountOut > 0 && amountInMax > 0);
        require(path.length == 2);
        require (path[0] != address(this) && path[1] != address(this));
        consumedToken = path[0];
        shouldBeConsumedAmount = amountInMax;
        IERC20WithDummyFunctionality(consumedToken).transferFrom(msg.sender, address(this), amountInMax);
        Nothing(to).nop{value:amountOut}();
        return someArr;
    }

    function swapExactTokensForETH(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts) {
        require(amountIn > 0 && amountOutMin > 0);
        require (path.length == 2);
        require (path[0] != address(this) && path[1] != address(this));
        consumedToken = path[0];
        shouldBeConsumedAmount = amountIn;
        IERC20WithDummyFunctionality(consumedToken).transferFrom(msg.sender, address(this), amountIn);
        Nothing(to).nop{value:amountOutMin}();
        return someArr;
    }

    function swapETHForExactTokens(
        uint256 amountOut,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external payable returns (uint256[] memory amounts) {
        require (amountOut > 0);
        require (path.length == 2);
        require (path[0] != address(this) && path[1] != address(this));
        generatedToken = path[1];
        IERC20WithDummyFunctionality(generatedToken).transfer(to, amountOut);
        return someArr;
    }

    // HKyberNetwork
    function swapTokenToToken(address src, uint srcAmount, address dest, uint minConversionRate) external returns(uint) {
        consumedToken = src;
        generatedToken = dest;
        shouldBeConsumedAmount = srcAmount;
        IERC20WithDummyFunctionality(src).transferFrom(msg.sender, address(this), srcAmount);
        IERC20WithDummyFunctionality(dest).transfer(msg.sender, someAmount);
    }
    function swapEtherToToken(address token, uint minConversionRate) external payable returns(uint) {
        generatedToken = token;
        IERC20WithDummyFunctionality(token).transfer(msg.sender, someAmount);
    }
    function swapTokenToEther(address token, uint srcAmount, uint minConversionRate) external returns(uint) {
        consumedToken = token;
        shouldBeConsumedAmount = srcAmount;
        IERC20WithDummyFunctionality(token).transferFrom(msg.sender, address(this), srcAmount);
        Nothing(msg.sender).nop{value:someAmount}();
    }

    // HBalancer
    function exitPool(uint256 poolAmountIn, uint256[] calldata minAmountsOut) external {
        consumedToken = address(this);
        shouldBeConsumedAmount = poolAmountIn;
        transferFrom(msg.sender, address(0), poolAmountIn);
    }
    function exitswapPoolAmountIn(address tokenOut, uint256 poolAmountIn, uint256 minAmountOut) external payable returns (uint256 tokenAmountOut) {
        consumedToken = address(this);
        shouldBeConsumedAmount = poolAmountIn;
        generatedToken = tokenOut;
        transferFrom(msg.sender, address(0), poolAmountIn);
        IERC20WithDummyFunctionality(tokenOut).transfer(msg.sender, minAmountOut);
    }

    // HGasTokens
    function freeFromUpTo(address from, uint256 value)
        external
        returns (uint256) {
            consumedToken = address(this);
            shouldBeConsumedAmount = value;
            transferFrom(from, address(0), value);
        }

    // HMooniswap
    function deposit(uint256[] calldata amounts, uint256[] calldata minAmounts) external payable returns(uint256) {
        // two tokens here
        consumedToken = address(erc20A);
        shouldBeConsumedAmount = amounts[0];
        require (erc20A < erc20B);
        erc20A.transferFrom(msg.sender, address(this), amounts[0]);
        erc20B.transferFrom(msg.sender, address(this), amounts[1]);
        generatedToken = address(this);
        transfer(msg.sender, someAmount);
        return someAmount;
    }
    function withdraw(uint256 amount, uint256[] calldata minAmounts) external {
        generatedToken = address(erc20A);
        consumedToken = address(this);
        shouldBeConsumedAmount = amount;
        transferFrom(msg.sender, address(this), amount);
        erc20A.transfer(msg.sender, minAmounts[0]);
        erc20B.transfer(msg.sender, minAmounts[1]);
    }
    function getTokens() external returns (address[] memory) {
        address[] memory ret = new address[](2);
        ret[0] = address(erc20A);
        ret[1] = address(erc20B);
        return ret;
    }

    address public consumedToken;
    address public generatedToken;
    uint public shouldBeConsumedAmount;
    function getBalance(address token, address who) public returns (uint) { return IERC20WithDummyFunctionality(token).balanceOf(who); }
}