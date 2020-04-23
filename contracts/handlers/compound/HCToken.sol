pragma solidity ^0.5.0;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "../HandlerBase.sol";
import "./ICToken.sol";

contract HCToken is HandlerBase {
    using SafeERC20 for IERC20;

    function mint(address cToken, uint256 mintAmount) external payable {
        address token = _getToken(cToken);
        IERC20(token).safeApprove(cToken, mintAmount);
        ICToken compound = ICToken(cToken);
        compound.mint(mintAmount);
        IERC20(token).safeApprove(cToken, 0);

        // Update involved token
        _updateToken(cToken);
    }

    function redeem(address cToken, uint256 redeemTokens) external payable {
        ICToken compound = ICToken(cToken);
        IERC20(cToken).safeApprove(cToken, redeemTokens);
        compound.redeem(redeemTokens);
        IERC20(cToken).safeApprove(cToken, 0);
        address token = _getToken(cToken);

        // Update involved token
        _updateToken(token);
    }

    function redeemUnderlying(address cToken, uint256 redeemAmount) external payable {
        ICToken compound = ICToken(cToken);
        IERC20(cToken).safeApprove(cToken, 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF);
        compound.redeemUnderlying(redeemAmount);
        IERC20(cToken).safeApprove(cToken, 0);
        address token = _getToken(cToken);

        // Update involved token
        _updateToken(token);
    }

    function _getToken(address token) internal view returns (address result) {
        return ICToken(token).underlying();
    }
}
