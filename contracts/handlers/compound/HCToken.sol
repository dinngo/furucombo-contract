pragma solidity ^0.6.0;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

import "../HandlerBase.sol";
import "./ICToken.sol";

contract HCToken is HandlerBase {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    function getContractName() public pure override returns (string memory) {
        return "HCToken";
    }

    function mint(address cToken, uint256 mintAmount)
        external
        payable
        returns (uint256)
    {
        // Get ctoken balance of proxy before mint
        ICToken compound = ICToken(cToken);
        uint256 beforeCTokenAmount = compound.balanceOf(address(this));

        address token = _getToken(cToken);
        // if amount == uint256(-1) return balance of Proxy
        mintAmount = _getProxyBalance(token, mintAmount);
        IERC20(token).safeApprove(cToken, mintAmount);
        try compound.mint(mintAmount) returns (uint256 errorCode) {
            if (errorCode != 0)
                _revertMsg(
                    "mint",
                    string(abi.encodePacked("error ", _uint2String(errorCode)))
                );
        } catch Error(string memory reason) {
            _revertMsg("mint", reason);
        } catch {
            _revertMsg("mint");
        }
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
        // if amount == uint256(-1) return balance of Proxy
        redeemTokens = _getProxyBalance(cToken, redeemTokens);
        IERC20(cToken).safeApprove(cToken, redeemTokens);
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
        if (repayAmount < debt) {
            debt = repayAmount;
        }
        IERC20(token).safeApprove(cToken, debt);
        try compound.repayBorrowBehalf(borrower, debt) returns (
            uint256 errorCode
        ) {
            if (errorCode != 0)
                _revertMsg(
                    "repayBorrowBehalf",
                    string(abi.encodePacked("error ", _uint2String(errorCode)))
                );
        } catch Error(string memory reason) {
            _revertMsg("repayBorrowBehalf", reason);
        } catch {
            _revertMsg("repayBorrowBehalf");
        }
        uint256 debtEnd = compound.borrowBalanceCurrent(borrower);
        IERC20(token).safeApprove(cToken, 0);
        return debtEnd;
    }

    function _getToken(address token) internal view returns (address result) {
        return ICToken(token).underlying();
    }
}
