pragma solidity ^0.5.0;

import "./IDSProxy.sol";
import "../HandlerBase.sol";

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";


contract HBalancer is HandlerBase {
    using SafeERC20 for IERC20;

    address constant BACTIONS = 0xde4A25A0b9589689945d842c5ba0CF4f0D4eB3ac;
    address constant PROXY_REGISTRY = 0x4678f0a6958e4D2Bc4F1BAF7Bc52E8F3564f3fE4;

    function joinswapExternAmountIn(
        address pool,
        address tokenIn,
        uint256 tokenAmountIn,
        uint256 minPoolAmountOut
    ) external payable {
        // Get furucombo DSProxy
        IDSProxy proxy = IDSProxy(_getProxy(address(this)));
        IERC20(tokenIn).safeApprove(address(proxy), tokenAmountIn);

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
        );
        IERC20(tokenIn).safeApprove(address(proxy), 0);

        // Update post process
        _updateToken(pool);
    }

    function joinPool(
        address[] calldata tokens,
        address pool,
        uint256 poolAmountOut,
        uint256[] calldata maxAmountsIn
    ) external payable {
        // Get furucombo DSProxy
        IDSProxy proxy = IDSProxy(_getProxy(address(this)));

        // approve all erc20 token to Proxy
        for (uint256 i = 0; i < tokens.length; i++) {
            IERC20(tokens[i]).safeApprove(address(proxy), maxAmountsIn[i]);
        }

        proxy.execute(
            BACTIONS,
            abi.encodeWithSelector(
                // selector of "joinPool(address,uint256,uint256[])"
                0x8a5c57df,
                pool,
                poolAmountOut,
                maxAmountsIn
            )
        );
        // approve all erc20 token 0
        for (uint256 i = 0; i < tokens.length; i++) {
            IERC20(tokens[i]).safeApprove(address(proxy), 0);
        }

        // Update post process
        _updateToken(pool);
    }

    function _getProxy(address user) internal returns (address) {
        return IDSProxyRegistry(PROXY_REGISTRY).proxies(user);
    }
}
