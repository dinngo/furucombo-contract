pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

import "../HandlerBase.sol";
import "../weth/IWETH9.sol";
import "./ISwapRouter.sol";
import "./libraries/BytesLib.sol";

contract HUniswapV3 is HandlerBase {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;
    using BytesLib for bytes;

    // prettier-ignore
    ISwapRouter public constant ROUTER = ISwapRouter(0xE592427A0AEce92De3Edee1F18E0157C05861564);
    // prettier-ignore
    IWETH9 public constant WETH = IWETH9(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);

    uint256 private constant PATH_SIZE = 43; // address + address + uint24
    uint256 private constant ADDRESS_SIZE = 20;

    function getContractName() public pure override returns (string memory) {
        return "HUniswapV3";
    }

    function exactInputSingleFromEther(
        address tokenIn,
        address tokenOut,
        uint24 fee,
        uint256 amountIn,
        uint256 amountOutMinimum,
        uint160 sqrtPriceLimitX96
    ) external payable returns (uint256 amountOut) {
        ISwapRouter.ExactInputSingleParams memory params;
        params.tokenIn = tokenIn;
        params.tokenOut = tokenOut;
        params.fee = fee;
        params.amountIn = _getBalance(address(0), amountIn);
        params.amountOutMinimum = amountOutMinimum;
        params.sqrtPriceLimitX96 = sqrtPriceLimitX96;

        amountOut = _exactInputSingle(params.amountIn, params);

        _updateToken(tokenOut);
    }

    function exactInputSingleToEther(
        address tokenIn,
        address tokenOut,
        uint24 fee,
        uint256 amountIn,
        uint256 amountOutMinimum,
        uint160 sqrtPriceLimitX96
    ) external payable returns (uint256 amountOut) {
        ISwapRouter.ExactInputSingleParams memory params;
        params.tokenIn = tokenIn;
        params.tokenOut = tokenOut;
        params.fee = fee;
        params.amountIn = _getBalance(tokenIn, amountIn);
        params.amountOutMinimum = amountOutMinimum;
        params.sqrtPriceLimitX96 = sqrtPriceLimitX96;

        // Approve token
        _tokenApprove(tokenIn, address(ROUTER), params.amountIn);
        amountOut = _exactInputSingle(0, params);

        WETH.withdraw(amountOut);
    }

    function exactInputSingle(
        address tokenIn,
        address tokenOut,
        uint24 fee,
        uint256 amountIn,
        uint256 amountOutMinimum,
        uint160 sqrtPriceLimitX96
    ) external payable returns (uint256 amountOut) {
        ISwapRouter.ExactInputSingleParams memory params;
        params.tokenIn = tokenIn;
        params.tokenOut = tokenOut;
        params.fee = fee;
        params.amountIn = _getBalance(tokenIn, amountIn);
        params.amountOutMinimum = amountOutMinimum;
        params.sqrtPriceLimitX96 = sqrtPriceLimitX96;

        // Approve token
        _tokenApprove(tokenIn, address(ROUTER), params.amountIn);
        amountOut = _exactInputSingle(0, params);

        _updateToken(tokenOut);
    }

    function exactInputFromEther(
        bytes calldata path,
        uint256 amountIn,
        uint256 amountOutMinimum
    ) external payable returns (uint256 amountOut) {
        ISwapRouter.ExactInputParams memory params;
        params.path = new bytes(path.length);
        params.path = path;
        params.amountIn = _getBalance(address(0), amountIn);
        params.amountOutMinimum = amountOutMinimum;

        amountOut = _exactInput(params.amountIn, params);

        address tokenOut = _getLastToken(path);
        _updateToken(tokenOut);
    }

    function exactInputToEther(
        bytes calldata path,
        uint256 amountIn,
        uint256 amountOutMinimum
    ) external payable returns (uint256 amountOut) {
        ISwapRouter.ExactInputParams memory params;
        params.path = new bytes(path.length);
        params.path = path;
        address tokenIn = _getFirstToken(path);
        params.amountIn = _getBalance(tokenIn, amountIn);
        params.amountOutMinimum = amountOutMinimum;

        // Approve token
        _tokenApprove(tokenIn, address(ROUTER), params.amountIn);
        amountOut = _exactInput(0, params);

        WETH.withdraw(amountOut);
    }

    function exactInput(
        bytes calldata path,
        uint256 amountIn,
        uint256 amountOutMinimum
    ) external payable returns (uint256 amountOut) {
        ISwapRouter.ExactInputParams memory params;
        params.path = new bytes(path.length);
        params.path = path;
        address tokenIn = _getFirstToken(path);
        params.amountIn = _getBalance(tokenIn, amountIn);
        params.amountOutMinimum = amountOutMinimum;

        // Approve token
        _tokenApprove(tokenIn, address(ROUTER), params.amountIn);
        amountOut = _exactInput(0, params);

        address tokenOut = _getLastToken(path);
        _updateToken(tokenOut);
    }

    function exactOutputSingleFromEther(
        address tokenIn,
        address tokenOut,
        uint24 fee,
        uint256 amountOut,
        uint256 amountInMaximum,
        uint160 sqrtPriceLimitX96
    ) external payable returns (uint256 amountIn) {
        ISwapRouter.ExactOutputSingleParams memory params;
        params.tokenIn = tokenIn;
        params.tokenOut = tokenOut;
        params.fee = fee;
        params.amountOut = amountOut;
        // if amount == uint256(-1) return balance of Proxy
        params.amountInMaximum = _getBalance(address(0), amountInMaximum);
        params.sqrtPriceLimitX96 = sqrtPriceLimitX96;

        amountIn = _exactOutputSingle(params.amountInMaximum, params);

        _updateToken(tokenOut);
    }

    function exactOutputSingleToEther(
        address tokenIn,
        address tokenOut,
        uint24 fee,
        uint256 amountOut,
        uint256 amountInMaximum,
        uint160 sqrtPriceLimitX96
    ) external payable returns (uint256 amountIn) {
        ISwapRouter.ExactOutputSingleParams memory params;
        params.tokenIn = tokenIn;
        params.tokenOut = tokenOut;
        params.fee = fee;
        params.amountOut = amountOut;
        // if amount == uint256(-1) return balance of Proxy
        params.amountInMaximum = _getBalance(tokenIn, amountInMaximum);
        params.sqrtPriceLimitX96 = sqrtPriceLimitX96;

        // Approve token
        _tokenApprove(params.tokenIn, address(ROUTER), params.amountInMaximum);
        amountIn = _exactOutputSingle(0, params);

        WETH.withdraw(params.amountOut);
    }

    function exactOutputSingle(
        address tokenIn,
        address tokenOut,
        uint24 fee,
        uint256 amountOut,
        uint256 amountInMaximum,
        uint160 sqrtPriceLimitX96
    ) external payable returns (uint256 amountIn) {
        ISwapRouter.ExactOutputSingleParams memory params;
        params.tokenIn = tokenIn;
        params.tokenOut = tokenOut;
        params.fee = fee;
        params.amountOut = amountOut;
        // if amount == uint256(-1) return balance of Proxy
        params.amountInMaximum = _getBalance(tokenIn, amountInMaximum);
        params.sqrtPriceLimitX96 = sqrtPriceLimitX96;

        // Approve token
        _tokenApprove(params.tokenIn, address(ROUTER), params.amountInMaximum);
        amountIn = _exactOutputSingle(0, params);

        _updateToken(params.tokenOut);
    }

    function exactOutputFromEther(
        bytes calldata path,
        uint256 amountOut,
        uint256 amountInMaximum
    ) external payable returns (uint256 amountIn) {
        ISwapRouter.ExactOutputParams memory params;
        params.path = new bytes(path.length);
        params.path = path;
        params.amountOut = amountOut;
        params.amountInMaximum = _getBalance(address(0), amountInMaximum);

        amountIn = _exactOutput(params.amountInMaximum, params);

        address tokenOut = _getFirstToken(path);
        _updateToken(tokenOut);
    }

    function exactOutputToEther(
        bytes calldata path,
        uint256 amountOut,
        uint256 amountInMaximum
    ) external payable returns (uint256 amountIn) {
        ISwapRouter.ExactOutputParams memory params;
        params.path = new bytes(path.length);
        params.path = path;
        params.amountOut = amountOut;
        address tokenIn = _getLastToken(path);
        // if amount == uint256(-1) return balance of Proxy
        params.amountInMaximum = _getBalance(tokenIn, amountInMaximum);
        // Approve token
        _tokenApprove(tokenIn, address(ROUTER), params.amountInMaximum);
        amountIn = _exactOutput(0, params);

        WETH.withdraw(amountOut);
    }

    function exactOutput(
        bytes calldata path,
        uint256 amountOut,
        uint256 amountInMaximum
    ) external payable returns (uint256 amountIn) {
        ISwapRouter.ExactOutputParams memory params;
        params.path = new bytes(path.length);
        params.path = path;
        params.amountOut = amountOut;
        address tokenIn = _getLastToken(path);
        // if amount == uint256(-1) return balance of Proxy
        params.amountInMaximum = _getBalance(tokenIn, amountInMaximum);

        // Approve token
        _tokenApprove(tokenIn, address(ROUTER), params.amountInMaximum);
        amountIn = _exactOutput(0, params);

        address tokenOut = _getFirstToken(path);
        _updateToken(tokenOut);
    }

    function _getFirstToken(bytes memory path)
        internal
        returns (address tokenOut)
    {
        return path.toAddress(0);
    }

    function _getLastToken(bytes memory path)
        internal
        returns (address tokenOut)
    {
        if (path.length < PATH_SIZE)
            _revertMsg("General", "Path size too small");
        return path.toAddress(path.length - ADDRESS_SIZE);
    }

    function _exactInputSingle(
        uint256 value,
        ISwapRouter.ExactInputSingleParams memory params
    ) internal returns (uint256) {
        params.deadline = now;
        params.recipient = address(this);

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
        params.deadline = now;
        params.recipient = address(this);

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
        params.deadline = now;
        params.recipient = address(this);

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
        params.deadline = now;
        params.recipient = address(this);

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
