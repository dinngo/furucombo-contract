pragma solidity ^0.6.0;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "../HandlerBase.sol";
import "./IUniswapFactory.sol";
import "./IUniswapExchange.sol";

contract HUniswap is HandlerBase {
    using SafeERC20 for IERC20;

    address constant UNISWAP_FACTORY = 0xc0a47dFe034B400B47bDaD5FecDa2621de6c4d95;

    function getContractName() public override pure returns (string memory) {
        return "HUniswap";
    }

    function addLiquidity(
        uint256 value,
        address token,
        uint256 max_tokens
    ) external payable returns (uint256 liquidity) {
        IUniswapExchange uniswap = _getExchange(token);
        IERC20(token).safeApprove(address(uniswap), max_tokens);
        try uniswap.addLiquidity.value(value)(1, max_tokens, now + 1) returns (
            uint256 ret
        ) {
            liquidity = ret;
        } catch Error(string memory reason) {
            _revertMsg("addLiquidity", reason);
        } catch {
            _revertMsg("addLiquidity");
        }
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
        try
            uniswap.removeLiquidity(amount, min_eth, min_tokens, now + 1)
        returns (uint256 ret1, uint256 ret2) {
            eth_gain = ret1;
            token_gain = ret2;
        } catch Error(string memory reason) {
            _revertMsg("removeLiquidity", reason);
        } catch {
            _revertMsg("removeLiquidity");
        }
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
        try uniswap.ethToTokenSwapInput.value(value)(min_tokens, now) returns (
            uint256 ret
        ) {
            tokens_bought = ret;
        } catch Error(string memory reason) {
            _revertMsg("ethToTokenSwapInput", reason);
        } catch {
            _revertMsg("ethToTokenSwapInput");
        }

        // Update involved token
        _updateToken(token);
    }

    function ethToTokenSwapOutput(
        uint256 value,
        address token,
        uint256 tokens_bought
    ) external payable returns (uint256 eth_sold) {
        IUniswapExchange uniswap = _getExchange(token);
        try
            uniswap.ethToTokenSwapOutput.value(value)(tokens_bought, now)
        returns (uint256 ret) {
            eth_sold = ret;
        } catch Error(string memory reason) {
            _revertMsg("ethToTokenSwapOutput", reason);
        } catch {
            _revertMsg("ethToTokenSwapOutput");
        }

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
        try uniswap.tokenToEthSwapInput(tokens_sold, min_eth, now) returns (
            uint256 ret
        ) {
            eth_bought = ret;
        } catch Error(string memory reason) {
            _revertMsg("tokenToEthSwapInput", reason);
        } catch {
            _revertMsg("tokenToEthSwapInput");
        }
        IERC20(token).safeApprove(address(uniswap), 0);
    }

    function tokenToEthSwapOutput(
        address token,
        uint256 eth_bought,
        uint256 max_tokens
    ) external payable returns (uint256 tokens_sold) {
        IUniswapExchange uniswap = _getExchange(token);
        IERC20(token).safeApprove(address(uniswap), max_tokens);
        try uniswap.tokenToEthSwapOutput(eth_bought, max_tokens, now) returns (
            uint256 ret
        ) {
            tokens_sold = ret;
        } catch Error(string memory reason) {
            _revertMsg("tokenToEthSwapOutput", reason);
        } catch {
            _revertMsg("tokenToEthSwapOutput");
        }
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
        try
            uniswap.tokenToTokenSwapInput(
                tokens_sold,
                min_tokens_bought,
                1,
                now,
                token_addr
            )
        returns (uint256 ret) {
            tokens_bought = ret;
        } catch Error(string memory reason) {
            _revertMsg("tokenToTokenSwapInput", reason);
        } catch {
            _revertMsg("tokenToTokenSwapInput");
        }
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
        try
            uniswap.tokenToTokenSwapOutput(
                tokens_bought,
                max_tokens_sold,
                0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff,
                now,
                token_addr
            )
        returns (uint256 ret) {
            tokens_sold = ret;
        } catch Error(string memory reason) {
            _revertMsg("tokenToTokenSwapOutput", reason);
        } catch {
            _revertMsg("tokenToTokenSwapOutput");
        }
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
