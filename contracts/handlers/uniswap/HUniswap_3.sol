pragma solidity ^0.5.0;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "../HandlerBase.sol";
import "./IUniswapFactory.sol";
import "./IUniswapExchange.sol";

contract HUniswap_3 is HandlerBase {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    function getFactory() public pure returns (address result) {
        return 0xc0a47dFe034B400B47bDaD5FecDa2621de6c4d95;
    }

    function tokenToTokenSwapInput(
        address token,
        uint256 tokens_sold,
        uint256 min_tokens_bought,
        address token_addr
    ) external returns (uint256 tokens_bought) {
        IUniswapFactory uniswapFactory = IUniswapFactory(getFactory());
        IUniswapExchange uniswap = IUniswapExchange(uniswapFactory.getExchange(token));
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
    ) external returns (uint256 tokens_sold) {
        IUniswapFactory uniswapFactory = IUniswapFactory(getFactory());
        IUniswapExchange uniswap = IUniswapExchange(uniswapFactory.getExchange(token));
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
}
