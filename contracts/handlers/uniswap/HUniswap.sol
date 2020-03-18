pragma solidity ^0.5.0;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "../HandlerBase.sol";
import "./IUniswapFactory.sol";
import "./IUniswapExchange.sol";

contract HUniswap is HandlerBase {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    function getFactory() public pure returns (address result) {
        return 0xc0a47dFe034B400B47bDaD5FecDa2621de6c4d95;
    }

    function ethToTokenSwapInput(
        uint256 value,
        address token,
        uint256 min_tokens
    ) external payable returns (uint256 tokens_bought) {
        IUniswapFactory uniswapFactory = IUniswapFactory(getFactory());
        IUniswapExchange uniswap = IUniswapExchange(uniswapFactory.getExchange(token));
        tokens_bought = uniswap.ethToTokenSwapInput.value(value)(min_tokens, now);

        // Update involved token
        _updateToken(token);
    }

    // TODO: test
    function ethToTokenSwapOutput(
        uint256 value,
        address token,
        uint256 tokens_bought
    ) external payable returns (uint256 eth_sold) {
        IUniswapFactory uniswapFactory = IUniswapFactory(getFactory());
        IUniswapExchange uniswap = IUniswapExchange(uniswapFactory.getExchange(token));
        eth_sold = uniswap.ethToTokenSwapOutput.value(value)(tokens_bought, now);

        // Update involved token
        _updateToken(token);
    }

    function addLiquidity(
        uint256 value,
        address token,
        uint256 max_tokens
    ) external payable returns (uint256 liquidity) {
        IUniswapFactory uniswapFactory = IUniswapFactory(getFactory());
        IUniswapExchange uniswap = IUniswapExchange(uniswapFactory.getExchange(token));
        IERC20(token).safeApprove(address(uniswap), max_tokens);
        liquidity = uniswap.addLiquidity.value(value)(1, max_tokens, now + 1);
        IERC20(token).safeApprove(address(uniswap), 0);

        // Update involved token
        _updateToken(address(uniswap));
    }
}
