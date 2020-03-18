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

    function ethToTokenSwapOutput(
        uint256 value,
        address token,
        uint256 tokens_bought
    ) external payable returns (uint256 eth_sold) {
        IUniswapFactory uniswapFactory = IUniswapFactory(getFactory());
        IUniswapExchange uniswap = IUniswapExchange(uniswapFactory.getExchange(token));
        uniswap.ethToTokenSwapOutput.value(value)(tokens_bought, now);

        // Update involved token
        _updateToken(token);
    }
}
