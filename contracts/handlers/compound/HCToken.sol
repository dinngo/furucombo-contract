pragma solidity ^0.6.0;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

import "../HandlerBase.sol";
import "./ICToken.sol";

contract HCToken is HandlerBase {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    function mint(address cToken, uint256 mintAmount)
        external
        payable
        returns (uint256)
    {
        // Get ctoken balance of proxy before mint
        ICToken compound = ICToken(cToken);
        uint256 beforeCTokenAmount = compound.balanceOf(address(this));

        address token = _getToken(cToken);
        IERC20(token).safeApprove(cToken, mintAmount);
        require(compound.mint(mintAmount) == 0, "compound mint failed");
        IERC20(token).safeApprove(cToken, 0);

        // Get ctoken balance of proxy after mint
        uint256 afterCTokenAmount = compound.balanceOf(address(this));

        // Update involved token
        _updateToken(cToken);
        return (afterCTokenAmount.sub(beforeCTokenAmount));
    }

    function redeem(address cToken, uint256 redeemTokens)
        external
        payable
        returns (uint256)
    {
        // Get token balance of proxy before redeem
        address token = _getToken(cToken);
        uint256 beforeTokenAmount = IERC20(token).balanceOf(address(this));

        ICToken compound = ICToken(cToken);
        IERC20(cToken).safeApprove(cToken, redeemTokens);
        require(compound.redeem(redeemTokens) == 0, "compound redeem failed");
        IERC20(cToken).safeApprove(cToken, 0);

        // Get token balance of proxy after redeem
        uint256 afterTokenAmount = IERC20(token).balanceOf(address(this));

        // Update involved token
        _updateToken(token);
        return (afterTokenAmount.sub(beforeTokenAmount));
    }

    function redeemUnderlying(address cToken, uint256 redeemAmount)
        external
        payable
        returns (uint256)
    {
        // Get ctoken balance of proxy before redeem
        ICToken compound = ICToken(cToken);
        uint256 beforeCTokenAmount = compound.balanceOf(address(this));

        IERC20(cToken).safeApprove(
            cToken,
            0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF
        );
        require(
            compound.redeemUnderlying(redeemAmount) == 0,
            "compound redeem underlying failed"
        );
        IERC20(cToken).safeApprove(cToken, 0);

        // Get ctoken balance of proxy after redeem
        uint256 afterCTokenAmount = compound.balanceOf(address(this));

        // Update involved token
        address token = _getToken(cToken);
        _updateToken(token);
        return (beforeCTokenAmount.sub(afterCTokenAmount));
    }

    function repayBorrowBehalf(
        address cToken,
        address borrower,
        uint256 repayAmount
    ) external payable returns (uint256) {
        ICToken compound = ICToken(cToken);
        address token = _getToken(cToken);

        uint256 debt = compound.borrowBalanceCurrent(borrower);
        uint256 remainingAmount;
        if (repayAmount < debt) {
            // Get remaining debt amount
            remainingAmount = debt.sub(repayAmount);
            debt = repayAmount;
        }
        IERC20(token).safeApprove(cToken, debt);
        require(
            compound.repayBorrowBehalf(borrower, debt) == 0,
            "compound repay failed"
        );
        IERC20(token).safeApprove(cToken, 0);
        return remainingAmount;
    }

    function _getToken(address token) internal view returns (address result) {
        return ICToken(token).underlying();
    }
}
