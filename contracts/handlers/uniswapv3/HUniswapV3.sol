pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

import "../HandlerBase.sol";
import "../weth/IWETH9.sol";
import "./ISwapRouter.sol";
import "./libraries/Path.sol";

contract HUniswapV3 is HandlerBase {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;
    using Path for bytes;

    // prettier-ignore
    ISwapRouter public constant ROUTER = ISwapRouter(0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D);
    // prettier-ignore
    IWETH9 public constant WETH = IWETH9(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);

    function getContractName() public pure override returns (string memory) {
        return "HUniswapV3";
    }

    function exactInputSingleFromEther(
        ISwapRouter.ExactInputSingleParams memory params
    ) external payable returns (uint256 amountOut) {
        params.amountIn = _getBalance(address(0), params.amountIn);
        amountOut = _exactInputSingle(params.amountIn, params);

        _updateToken(params.tokenOut);
    }

    function exactInputSingleToEther(
        ISwapRouter.ExactInputSingleParams memory params
    ) external payable returns (uint256 amountOut) {
        params.amountIn = _getBalance(params.tokenIn, params.amountIn);
        IERC20(params.tokenIn).safeTransfer(address(ROUTER), params.amountIn);
        amountOut = _exactInputSingle(0, params);

        WETH.withdraw(amountOut);
    }

    function exactInputSingle(ISwapRouter.ExactInputSingleParams memory params)
        external
        payable
        returns (uint256 amountOut)
    {
        params.amountIn = _getBalance(params.tokenIn, params.amountIn);
        IERC20(params.tokenIn).safeTransfer(address(ROUTER), params.amountIn);
        amountOut = _exactInputSingle(0, params);

        _updateToken(params.tokenOut);
    }

    function exactInputFromEther(ISwapRouter.ExactInputParams memory params)
        external
        payable
        returns (uint256 amountOut)
    {
        params.amountIn = _getBalance(address(0), params.amountIn);
        amountOut = _exactInput(params.amountIn, params);

        address tokenOut = _getTokenOut(params.path);
        _updateToken(tokenOut);
    }

    function exactInputToEther(ISwapRouter.ExactInputParams memory params)
        external
        payable
        returns (uint256 amountOut)
    {
        (address tokenIn, , ) = params.path.decodeFirstPool();
        params.amountIn = _getBalance(tokenIn, params.amountIn);
        IERC20(tokenIn).safeTransfer(address(ROUTER), params.amountIn);
        amountOut = _exactInput(0, params);

        WETH.withdraw(amountOut);
    }

    function exactInput(ISwapRouter.ExactInputParams memory params)
        external
        payable
        returns (uint256 amountOut)
    {
        (address tokenIn, , ) = params.path.decodeFirstPool();
        params.amountIn = _getBalance(tokenIn, params.amountIn);
        IERC20(tokenIn).safeTransfer(address(ROUTER), params.amountIn);
        amountOut = _exactInput(0, params);

        address tokenOut = _getTokenOut(params.path);
        _updateToken(tokenOut);
    }

    function exactOutputSingleFromEther(
        ISwapRouter.ExactOutputSingleParams memory params
    ) external payable returns (uint256 amountIn) {
        // if amount == uint256(-1) return balance of Proxy
        params.amountInMaximum = _getBalance(
            params.tokenIn,
            params.amountInMaximum
        );
        amountIn = _exactOutputSingle(params.amountInMaximum, params);

        _updateToken(params.tokenOut);
    }

    function exactOutputSingleToEther(
        ISwapRouter.ExactOutputSingleParams memory params
    ) external payable returns (uint256 amountIn) {
        // if amount == uint256(-1) return balance of Proxy
        params.amountInMaximum = _getBalance(
            params.tokenIn,
            params.amountInMaximum
        );

        // Approve token
        _tokenApprove(params.tokenIn, address(ROUTER), params.amountInMaximum);
        amountIn = _exactOutputSingle(0, params);

        WETH.withdraw(params.amountOut);
    }

    function exactOutputSingle(
        ISwapRouter.ExactOutputSingleParams memory params
    ) external payable returns (uint256 amountIn) {
        // if amount == uint256(-1) return balance of Proxy
        params.amountInMaximum = _getBalance(
            params.tokenIn,
            params.amountInMaximum
        );
        // Approve token
        _tokenApprove(params.tokenIn, address(ROUTER), params.amountInMaximum);
        amountIn = _exactOutputSingle(0, params);

        _updateToken(params.tokenOut);
    }

    function exactOutputFromEther(ISwapRouter.ExactOutputParams memory params)
        external
        payable
        returns (uint256 amountIn)
    {
        params.amountInMaximum = _getBalance(
            address(0),
            params.amountInMaximum
        );
        amountIn = _exactOutput(params.amountInMaximum, params);

        address tokenOut = _getTokenOut(params.path);
        _updateToken(tokenOut);
    }

    function exactOutputToEther(ISwapRouter.ExactOutputParams memory params)
        external
        payable
        returns (uint256 amountIn)
    {
        (address tokenIn, , ) = params.path.decodeFirstPool();
        // if amount == uint256(-1) return balance of Proxy
        params.amountInMaximum = _getBalance(tokenIn, params.amountInMaximum);
        // Approve token
        _tokenApprove(tokenIn, address(ROUTER), params.amountInMaximum);
        amountIn = _exactOutput(0, params);

        WETH.withdraw(params.amountOut);
    }

    function exactOutput(ISwapRouter.ExactOutputParams memory params)
        external
        payable
        returns (uint256 amountIn)
    {
        (address tokenIn, , ) = params.path.decodeFirstPool();
        // if amount == uint256(-1) return balance of Proxy
        params.amountInMaximum = _getBalance(tokenIn, params.amountInMaximum);
        // Approve token
        _tokenApprove(tokenIn, address(ROUTER), params.amountInMaximum);
        amountIn = _exactOutput(0, params);

        address tokenOut = _getTokenOut(params.path);
        _updateToken(tokenOut);
    }

    function _getTokenOut(bytes memory path)
        internal
        returns (address tokenOut)
    {
        // TODO: optimize the fetching flow
        while (path.hasMultiplePools()) {
            path = path.skipToken();
        }

        (, tokenOut, ) = path.decodeFirstPool();
    }

    function _exactInputSingle(
        uint256 value,
        ISwapRouter.ExactInputSingleParams memory params
    ) internal returns (uint256) {
        try ROUTER.exactInputSingle{value: value}(params) returns (
            uint256 amountOut
        ) {
            return amountOut;
        } catch Error(string memory reason) {
            _revertMsg("exactInputSingle", reason);
        } catch {
            _revertMsg("exactInputSingle");
        }
    }

    function _exactInput(
        uint256 value,
        ISwapRouter.ExactInputParams memory params
    ) internal returns (uint256) {
        try ROUTER.exactInput{value: value}(params) returns (
            uint256 amountOut
        ) {
            return amountOut;
        } catch Error(string memory reason) {
            _revertMsg("exactInput", reason);
        } catch {
            _revertMsg("exactInput");
        }
    }

    function _exactOutputSingle(
        uint256 value,
        ISwapRouter.ExactOutputSingleParams memory params
    ) internal returns (uint256) {
        try ROUTER.exactOutputSingle{value: value}(params) returns (
            uint256 amountIn
        ) {
            return amountIn;
        } catch Error(string memory reason) {
            _revertMsg("exactOutputSingle", reason);
        } catch {
            _revertMsg("exactOutputSingle");
        }
    }

    function _exactOutput(
        uint256 value,
        ISwapRouter.ExactOutputParams memory params
    ) internal returns (uint256) {
        try ROUTER.exactOutput{value: value}(params) returns (
            uint256 amountIn
        ) {
            return amountIn;
        } catch Error(string memory reason) {
            _revertMsg("exactOutput", reason);
        } catch {
            _revertMsg("exactOutput");
        }
    }
}
