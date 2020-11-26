pragma solidity ^0.6.0;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "../HandlerBase.sol";
import "./IUniswapFactory.sol";
import "./IUniswapExchange.sol";

contract HUniswap is HandlerBase {
    using SafeERC20 for IERC20;

    // prettier-ignore
    address public constant UNISWAP_FACTORY = 0xc0a47dFe034B400B47bDaD5FecDa2621de6c4d95;

    function getContractName() public pure override returns (string memory) {
        return "HUniswap";
    }

    function addLiquidity(
        uint256 value,
        address token,
        uint256 maxTokens
    ) external payable returns (uint256 liquidity) {
        IUniswapExchange uniswap = _getExchange(token);
        IERC20(token).safeApprove(address(uniswap), maxTokens);
        try uniswap.addLiquidity.value(value)(1, maxTokens, now + 1) returns (
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
        uint256 minEth,
        uint256 minTokens
    ) external payable returns (uint256 ethGain, uint256 tokenGain) {
        IUniswapExchange uniswap = _getExchange(token);
        IERC20(address(uniswap)).safeApprove(address(uniswap), amount);
        try
            uniswap.removeLiquidity(amount, minEth, minTokens, now + 1)
        returns (uint256 ret1, uint256 ret2) {
            ethGain = ret1;
            tokenGain = ret2;
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
        uint256 minTokens
    ) external payable returns (uint256 tokensBought) {
        IUniswapExchange uniswap = _getExchange(token);
        try uniswap.ethToTokenSwapInput.value(value)(minTokens, now) returns (
            uint256 ret
        ) {
            tokensBought = ret;
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
        uint256 tokensBought
    ) external payable returns (uint256 ethSold) {
        IUniswapExchange uniswap = _getExchange(token);
        try
            uniswap.ethToTokenSwapOutput.value(value)(tokensBought, now)
        returns (uint256 ret) {
            ethSold = ret;
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
        uint256 tokensSold,
        uint256 minEth
    ) external payable returns (uint256 ethBought) {
        IUniswapExchange uniswap = _getExchange(token);
        IERC20(token).safeApprove(address(uniswap), tokensSold);
        try uniswap.tokenToEthSwapInput(tokensSold, minEth, now) returns (
            uint256 ret
        ) {
            ethBought = ret;
        } catch Error(string memory reason) {
            _revertMsg("tokenToEthSwapInput", reason);
        } catch {
            _revertMsg("tokenToEthSwapInput");
        }
        IERC20(token).safeApprove(address(uniswap), 0);
    }

    function tokenToEthSwapOutput(
        address token,
        uint256 ethBought,
        uint256 maxTokens
    ) external payable returns (uint256 tokensSold) {
        IUniswapExchange uniswap = _getExchange(token);
        IERC20(token).safeApprove(address(uniswap), maxTokens);
        try uniswap.tokenToEthSwapOutput(ethBought, maxTokens, now) returns (
            uint256 ret
        ) {
            tokensSold = ret;
        } catch Error(string memory reason) {
            _revertMsg("tokenToEthSwapOutput", reason);
        } catch {
            _revertMsg("tokenToEthSwapOutput");
        }
        IERC20(token).safeApprove(address(uniswap), 0);
    }

    function tokenToTokenSwapInput(
        address token,
        uint256 tokensSold,
        uint256 minTokensBought,
        address tokenAddr
    ) external payable returns (uint256 tokensBought) {
        IUniswapExchange uniswap = _getExchange(token);
        IERC20(token).safeApprove(address(uniswap), tokensSold);
        try
            uniswap.tokenToTokenSwapInput(
                tokensSold,
                minTokensBought,
                1,
                now,
                tokenAddr
            )
        returns (uint256 ret) {
            tokensBought = ret;
        } catch Error(string memory reason) {
            _revertMsg("tokenToTokenSwapInput", reason);
        } catch {
            _revertMsg("tokenToTokenSwapInput");
        }
        IERC20(token).safeApprove(address(uniswap), 0);

        // Update involved token
        _updateToken(tokenAddr);
    }

    function tokenToTokenSwapOutput(
        address token,
        uint256 tokensBought,
        uint256 maxTokensSold,
        address tokenAddr
    ) external payable returns (uint256 tokensSold) {
        IUniswapExchange uniswap = _getExchange(token);
        IERC20(token).safeApprove(address(uniswap), maxTokensSold);
        try
            uniswap.tokenToTokenSwapOutput(
                tokensBought,
                maxTokensSold,
                0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff,
                now,
                tokenAddr
            )
        returns (uint256 ret) {
            tokensSold = ret;
        } catch Error(string memory reason) {
            _revertMsg("tokenToTokenSwapOutput", reason);
        } catch {
            _revertMsg("tokenToTokenSwapOutput");
        }
        IERC20(token).safeApprove(address(uniswap), 0);

        // Update involved token
        _updateToken(tokenAddr);
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
