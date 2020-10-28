pragma solidity ^0.6.0;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

import "../HandlerBase.sol";
import "./ICEther.sol";

contract HCEther is HandlerBase {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    address public constant CETHER = 0x4Ddc2D193948926D02f9B1fE9e1daa0718270ED5;

    function mint(uint256 value) external payable returns (uint256) {
        // uint256 beforeCEtherAmount = IERC20(CETHER).balanceOf(address(this));
        ICEther compound = ICEther(CETHER);
        uint256 beforeCEtherAmount = compound.balanceOf(address(this));
        compound.mint.value(value)();
        uint256 afterCEtherAmount = compound.balanceOf(address(this));

        // Update involved token
        _updateToken(CETHER);
        return (afterCEtherAmount.sub(beforeCEtherAmount));
    }

    function redeem(uint256 redeemTokens) external payable returns (uint256) {
        // Get balance of proxy before redeem
        uint256 beforeRedeemAmount = address(this).balance;

        // Execute compound redeem function
        ICEther compound = ICEther(CETHER);
        IERC20(CETHER).safeApprove(CETHER, redeemTokens);
        require(compound.redeem(redeemTokens) == 0, "compound redeem failed");
        IERC20(CETHER).safeApprove(CETHER, 0);

        // Get balance of proxy after redeem
        uint256 afterRedeemAmount = address(this).balance;
        return (afterRedeemAmount.sub(beforeRedeemAmount));
    }

    function redeemUnderlying(uint256 redeemAmount)
        external
        payable
        returns (uint256)
    {
        // Get balance of proxy before redeem
        uint256 beforeCEtherAmount = IERC20(CETHER).balanceOf(address(this));

        ICEther compound = ICEther(CETHER);
        IERC20(CETHER).safeApprove(
            CETHER,
            0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF
        );
        require(
            compound.redeemUnderlying(redeemAmount) == 0,
            "compound redeem underlying failed"
        );
        IERC20(CETHER).safeApprove(CETHER, 0);

        // Get balance of proxy after redeem
        uint256 afterCEtherAmount = IERC20(CETHER).balanceOf(address(this));
        return (beforeCEtherAmount.sub(afterCEtherAmount));
    }

    function repayBorrowBehalf(uint256 amount, address borrower)
        external
        payable
        returns (uint256)
    {
        ICEther compound = ICEther(CETHER);
        uint256 debt = compound.borrowBalanceCurrent(borrower);
        uint256 remainingAmount;
        if (amount < debt) {
            remainingAmount = debt.sub(amount);
            debt = amount;
        }
        compound.repayBorrowBehalf.value(debt)(borrower);
        return remainingAmount;
    }
}
