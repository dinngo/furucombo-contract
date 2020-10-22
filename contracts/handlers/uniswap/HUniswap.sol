pragma solidity ^0.6.0;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "../HandlerBase.sol";
import "./IUniswapFactory.sol";
import "./IUniswapExchange.sol";

contract HUniswap is HandlerBase {
    using SafeERC20 for IERC20;

    address constant UNISWAP_FACTORY = 0xc0a47dFe034B400B47bDaD5FecDa2621de6c4d95;

    function addLiquidity(
        uint256 value,
        address token,
        uint256 max_tokens
    ) external payable returns (uint256 liquidity) {
        IUniswapExchange uniswap = _getExchange(token);
        IERC20(token).safeApprove(address(uniswap), max_tokens);
        liquidity = uniswap.addLiquidity.value(value)(1, max_tokens, now + 1);
        IERC20(token).safeApprove(address(uniswap), 0);

        // Update involved token
        _updateToken(address(uniswap));
    }

    function removeLiquidity(
        address token,
        uint256 amount,
        uint256 min_eth,
        uint256 min_tokens
    ) external payable returns (uint256 eth_gain, uint256 token_gain) {
        IUniswapExchange uniswap = _getExchange(token);
        IERC20(address(uniswap)).safeApprove(address(uniswap), amount);
        (eth_gain, token_gain) = uniswap.removeLiquidity(
            amount,
            min_eth,
            min_tokens,
            now + 1
        );
        IERC20(address(uniswap)).safeApprove(address(uniswap), 0);

        // Update involved token
        _updateToken(token);
    }

    function ethToTokenSwapInput(
        uint256 value,
        address token,
        uint256 min_tokens
    ) external payable returns (uint256 tokens_bought) {
        IUniswapExchange uniswap = _getExchange(token);
        tokens_bought = uniswap.ethToTokenSwapInput.value(value)(
            min_tokens,
            now
        );

        // Update involved token
        _updateToken(token);
    }

    function ethToTokenSwapOutput(
        uint256 value,
        address token,
        uint256 tokens_bought
    ) external payable returns (uint256 eth_sold) {
        IUniswapExchange uniswap = _getExchange(token);
        eth_sold = uniswap.ethToTokenSwapOutput.value(value)(
            tokens_bought,
            now
        );

        // Update involved token
        _updateToken(token);
    }

    function tokenToEthSwapInput(
        address token,
        uint256 tokens_sold,
        uint256 min_eth
    ) external payable returns (uint256 eth_bought) {
        IUniswapExchange uniswap = _getExchange(token);
        IERC20(token).safeApprove(address(uniswap), tokens_sold);
        eth_bought = uniswap.tokenToEthSwapInput(tokens_sold, min_eth, now);
        IERC20(token).safeApprove(address(uniswap), 0);
    }

    function tokenToEthSwapOutput(
        address token,
        uint256 eth_bought,
        uint256 max_tokens
    ) external payable returns (uint256 tokens_sold) {
        IUniswapExchange uniswap = _getExchange(token);
        IERC20(token).safeApprove(address(uniswap), max_tokens);
        tokens_sold = uniswap.tokenToEthSwapOutput(eth_bought, max_tokens, now);
        IERC20(token).safeApprove(address(uniswap), 0);
    }

    function tokenToTokenSwapInput(
        address token,
        uint256 tokens_sold,
        uint256 min_tokens_bought,
        address token_addr
    ) external payable returns (uint256 tokens_bought) {
        IUniswapExchange uniswap = _getExchange(token);
        IERC20(token).safeApprove(address(uniswap), tokens_sold);
        tokens_bought = uniswap.tokenToTokenSwapInput(
            tokens_sold,
            min_tokens_bought,
            1,
            now,
            token_addr
        );
        IERC20(token).safeApprove(address(uniswap), 0);

        // Update involved token
        _updateToken(token_addr);
    }

    function tokenToTokenSwapOutput(
        address token,
        uint256 tokens_bought,
        uint256 max_tokens_sold,
        address token_addr
    ) external payable returns (uint256 tokens_sold) {
        IUniswapExchange uniswap = _getExchange(token);
        IERC20(token).safeApprove(address(uniswap), max_tokens_sold);
        tokens_sold = uniswap.tokenToTokenSwapOutput(
            tokens_bought,
            max_tokens_sold,
            0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff,
            now,
            token_addr
        );
        IERC20(token).safeApprove(address(uniswap), 0);

        // Update involved token
        _updateToken(token_addr);
    }

    function _getExchange(address token)
        internal
        view
        returns (IUniswapExchange uniswap)
    {
        IUniswapFactory uniswapFactory = IUniswapFactory(UNISWAP_FACTORY);
        uniswap = IUniswapExchange(uniswapFactory.getExchange(token));
    }
}
