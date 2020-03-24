pragma solidity ^0.5.0;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "../HandlerBase.sol";
import "./ICToken.sol";

contract HCToken is HandlerBase {
    using SafeERC20 for IERC20;

    function _getToken(address token) internal view returns (address result) {
        return ICToken(token).underlying();
    }

    function mint(address cToken, uint256 amount) external {
        address token = _getToken(cToken);
        IERC20(token).safeApprove(cToken, amount);
        ICToken compound = ICToken(cToken);
        compound.mint(amount);
        IERC20(token).safeApprove(cToken, 0);

        // Update involved token
        _updateToken(cToken);
    }
}
