pragma solidity ^0.6.0;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "../handlers/HandlerBase.sol";

interface IFaucet {
    function drain() external payable;

    function drainToken(address token, uint256 amount) external;
}

contract HMock is HandlerBase {
    using SafeERC20 for IERC20;

    function drain(address target, uint256 v) external payable {
        IFaucet(target).drain.value(v)();
    }

    function drainToken(
        address target,
        address token,
        uint256 amount
    ) external payable {
        IERC20(token).safeApprove(target, amount);
        IFaucet(target).drainToken(token, amount);
        IERC20(token).safeApprove(target, 0);
    }
}
