pragma solidity ^0.6.0;

import "../maker/IDSProxy.sol";
import "./IBPool.sol";
import "../HandlerBase.sol";

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

contract HBalancer is HandlerBase {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    // prettier-ignore
    address public constant BACTIONS = 0xde4A25A0b9589689945d842c5ba0CF4f0D4eB3ac;
    // prettier-ignore
    address public constant PROXY_REGISTRY = 0x4678f0a6958e4D2Bc4F1BAF7Bc52E8F3564f3fE4;

    function getContractName() public override pure returns (string memory) {
        return "HBalancer";
    }

    function joinswapExternAmountIn(
        address pool,
        address tokenIn,
        uint256 tokenAmountIn,
        uint256 minPoolAmountOut
    ) external payable returns (uint256) {
        // Get furucombo DSProxy
        IDSProxy proxy = IDSProxy(_getProxy(address(this)));
        uint256 beforePoolAmount = IERC20(pool).balanceOf(address(this));

        // Execute "joinswapExternAmountIn" by using DSProxy
        IERC20(tokenIn).safeApprove(address(proxy), tokenAmountIn);
        try
            proxy.execute(
                BACTIONS,
                abi.encodeWithSelector(
                    // selector of "joinswapExternAmountIn(address,address,uint256,uint256)"
                    0xc1762b15,
                    pool,
                    tokenIn,
                    tokenAmountIn,
                    minPoolAmountOut
                )
            )
         {} catch Error(string memory reason) {
            _revertMsg("joinswapExternAmountIn", reason);
        } catch {
            _revertMsg("joinswapExternAmountIn");
        }
        IERC20(tokenIn).safeApprove(address(proxy), 0);
        uint256 afterPoolAmount = IERC20(pool).balanceOf(address(this));

        // Update post process
        _updateToken(pool);
        return afterPoolAmount.sub(beforePoolAmount);
    }

    function joinPool(
        address pool,
        uint256 poolAmountOut,
        uint256[] calldata maxAmountsIn
    ) external payable returns (uint256[] memory) {
        // Get all tokens of pool
        IBPool bPool = IBPool(pool);
        address[] memory tokens = bPool.getFinalTokens();
        if (tokens.length != maxAmountsIn.length)
            _revertMsg("joinPool", "token and amount does not match");

        // Get furucombo DSProxy
        IDSProxy proxy = IDSProxy(_getProxy(address(this)));
        uint256[] memory amountsIn = new uint256[](tokens.length);

        // Approve all erc20 token to Proxy
        for (uint256 i = 0; i < tokens.length; i++) {
            IERC20(tokens[i]).safeApprove(address(proxy), maxAmountsIn[i]);
            amountsIn[i] = IERC20(tokens[i]).balanceOf(address(this));
        }

        // Execute "joinPool" by using DSProxy
        try
            proxy.execute(
                BACTIONS,
                abi.encodeWithSelector(
                    // selector of "joinPool(address,uint256,uint256[])"
                    0x8a5c57df,
                    pool,
                    poolAmountOut,
                    maxAmountsIn
                )
            )
         {} catch Error(string memory reason) {
            _revertMsg("joinPool", reason);
        } catch {
            _revertMsg("joinPool");
        }

        // Reset approval of tokens to 0
        for (uint256 i = 0; i < tokens.length; i++) {
            IERC20(tokens[i]).safeApprove(address(proxy), 0);
            amountsIn[i] = amountsIn[i].sub(
                IERC20(tokens[i]).balanceOf(address(this))
            );
        }

        // Update post process
        _updateToken(pool);
        return amountsIn;
    }

    function exitswapPoolAmountIn(
        address pool,
        address tokenOut,
        uint256 poolAmountIn,
        uint256 minAmountOut
    ) external payable returns (uint256 tokenAmountOut) {
        // Get pool of balancer
        IBPool bPool = IBPool(pool);

        // Call exitswapPoolAmountIn function of balancer pool
        try
            bPool.exitswapPoolAmountIn(tokenOut, poolAmountIn, minAmountOut)
        returns (uint256 amount) {
            tokenAmountOut = amount;
        } catch Error(string memory reason) {
            _revertMsg("exitswapPoolAmountIn", reason);
        } catch {
            _revertMsg("exitswapPoolAmountIn");
        }

        // Update post process
        _updateToken(tokenOut);
    }

    function exitPool(
        address pool,
        uint256 poolAmountIn,
        uint256[] calldata minAmountsOut
    ) external payable returns (uint256[] memory) {
        // Get all tokens of pool
        IBPool bPool = IBPool(pool);

        address[] memory tokens = bPool.getFinalTokens();
        // uint256[tokens.length] memory tokenAmounts;
        if (minAmountsOut.length != tokens.length)
            _revertMsg("exitPool", "token and amount does not match");

        uint256[] memory amountsIn = new uint256[](tokens.length);
        for (uint256 i = 0; i < tokens.length; i++) {
            amountsIn[i] = IERC20(tokens[i]).balanceOf(address(this));
        }

        // Call exitPool function of balancer pool
        try bPool.exitPool(poolAmountIn, minAmountsOut)  {} catch Error(
            string memory reason
        ) {
            _revertMsg("exitPool", reason);
        } catch {
            _revertMsg("exitPool");
        }

        // Update post process
        for (uint256 i = 0; i < tokens.length; i++) {
            _updateToken(tokens[i]);
            amountsIn[i] = IERC20(tokens[i]).balanceOf(address(this)).sub(
                amountsIn[i]
            );
        }
        return amountsIn;
    }

    function _getProxy(address user) internal returns (address) {
        return IDSProxyRegistry(PROXY_REGISTRY).proxies(user);
    }
}
