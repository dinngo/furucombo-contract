pragma solidity ^0.6.0;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

import "../HandlerBase.sol";
import "./ICEther.sol";

contract HCEther is HandlerBase {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    address public constant CETHER = 0x4Ddc2D193948926D02f9B1fE9e1daa0718270ED5;

    function getContractName() public pure override returns (string memory) {
        return "HCEther";
    }

    function mint(uint256 value) external payable returns (uint256) {
        ICEther compound = ICEther(CETHER);

        // Get cether balance of proxy before mint
        uint256 beforeCEtherAmount = compound.balanceOf(address(this));

        // Execute mint
        try compound.mint{value: value}() {} catch Error(string memory reason) {
            _revertMsg("mint", reason);
        } catch {
            _revertMsg("mint");
        }

        // Get cether balance of proxy after mint
        uint256 afterCEtherAmount = compound.balanceOf(address(this));

        // Update involved token
        _updateToken(CETHER);
        return (afterCEtherAmount.sub(beforeCEtherAmount));
    }

    function redeem(uint256 redeemTokens) external payable returns (uint256) {
        // Get ether balance of proxy before redeem
        uint256 beforeRedeemAmount = address(this).balance;

        // Approve cether
        ICEther compound = ICEther(CETHER);
        IERC20(CETHER).safeApprove(CETHER, redeemTokens);

        // Execute redeem
        try compound.redeem(redeemTokens) returns (uint256 errorCode) {
            if (errorCode != 0)
                _revertMsg(
                    "redeem",
                    string(abi.encodePacked("error ", _uint2String(errorCode)))
                );
        } catch Error(string memory reason) {
            _revertMsg("redeem", reason);
        } catch {
            _revertMsg("redeem");
        }

        // Approve cether to zero
        IERC20(CETHER).safeApprove(CETHER, 0);

        // Get ether balance of proxy after redeem
        uint256 afterRedeemAmount = address(this).balance;
        return (afterRedeemAmount.sub(beforeRedeemAmount));
    }

    function redeemUnderlying(uint256 redeemAmount)
        external
        payable
        returns (uint256)
    {
        // Get cether balance of proxy before redeemUnderlying
        ICEther compound = ICEther(CETHER);
        uint256 beforeCEtherAmount = compound.balanceOf(address(this));

        IERC20(CETHER).safeApprove(
            CETHER,
            0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF
        );
        try compound.redeemUnderlying(redeemAmount) returns (
            uint256 errorCode
        ) {
            if (errorCode != 0)
                _revertMsg(
                    "redeemUnderlying",
                    string(abi.encodePacked("error ", _uint2String(errorCode)))
                );
        } catch Error(string memory reason) {
            _revertMsg("redeemUnderlying", reason);
        } catch {
            _revertMsg("redeemUnderlying");
        }
        IERC20(CETHER).safeApprove(CETHER, 0);

        // Get cether balance of proxy after redeemUnderlying
        uint256 afterCEtherAmount = compound.balanceOf(address(this));
        return (beforeCEtherAmount.sub(afterCEtherAmount));
    }

    function repayBorrowBehalf(uint256 amount, address borrower)
        external
        payable
        returns (uint256)
    {
        ICEther compound = ICEther(CETHER);
        uint256 debt = compound.borrowBalanceCurrent(borrower);
        if (amount < debt) {
            debt = amount;
        }
        try compound.repayBorrowBehalf{value: debt}(borrower) {} catch Error(
            string memory reason
        ) {
            _revertMsg("repayBorrowBehalf", reason);
        } catch {
            _revertMsg("repayBorrowBehalf");
        }
        uint256 debtEnd = compound.borrowBalanceCurrent(borrower);
        return debtEnd;
    }
}
