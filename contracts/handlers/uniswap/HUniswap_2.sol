pragma solidity ^0.5.0;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "../HandlerBase.sol";
import "./IUniswapFactory.sol";
import "./IUniswapExchange.sol";

contract HUniswap_2 is HandlerBase {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    function getFactory() public pure returns (address result) {
        return 0xc0a47dFe034B400B47bDaD5FecDa2621de6c4d95;
    }

    function tokenToEthSwapInput(
        address token,
        uint256 tokens_sold,
        uint256 min_eth
    ) external returns (uint256 eth_bought) {
        IUniswapFactory uniswapFactory = IUniswapFactory(getFactory());
        IUniswapExchange uniswap = IUniswapExchange(uniswapFactory.getExchange(token));
        IERC20(token).safeApprove(address(uniswap), tokens_sold);
        eth_bought = uniswap.tokenToEthSwapInput(tokens_sold, min_eth, now);
        IERC20(token).safeApprove(address(uniswap), 0);
    }

    function tokenToEthSwapOutput(
        uint256 max_tokens,
        address token,
        uint256 eth_bought
    ) external returns (uint256 tokens_sold) {
        IUniswapFactory uniswapFactory = IUniswapFactory(getFactory());
        IUniswapExchange uniswap = IUniswapExchange(uniswapFactory.getExchange(token));
        IERC20(token).safeApprove(address(uniswap), max_tokens);
        tokens_sold = uniswap.tokenToEthSwapOutput(eth_bought, max_tokens, now);
        IERC20(token).safeApprove(address(uniswap), 0);
    }
}
