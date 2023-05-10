// SPDX-License-Identifier: MIT

pragma solidity 0.8.10;

import {HandlerBase, IERC20} from "../HandlerBase.sol";
import {IWrappedNativeToken} from "../wrappednativetoken/IWrappedNativeToken.sol";
import {IComet} from "./IComet.sol";

contract HCompoundV3 is HandlerBase {
    address public immutable wrappedNativeToken;

    constructor(address wrappedNativeToken_) {
        wrappedNativeToken = wrappedNativeToken_;
    }

    function getContractName() public pure override returns (string memory) {
        return "HCompoundV3";
    }

    function supplyBase(
        address cTokenV3,
        uint256 amount
    ) external payable returns (uint256 amountOut) {
        _requireMsg(amount != 0, "supplyBase", "zero amount");

        address baseToken = IComet(cTokenV3).baseToken();
        amount = _getBalance(baseToken, amount);
        uint256 initBal = IComet(cTokenV3).balanceOf(address(this));
        _supply(
            cTokenV3,
            address(this), // to
            baseToken,
            amount
        );
        amountOut = IComet(cTokenV3).balanceOf(address(this)) - initBal;
        _updateToken(cTokenV3);
    }

    function supplyBaseETH(
        address cTokenV3,
        uint256 amount
    ) external payable returns (uint256 amountOut) {
        _requireMsg(
            IComet(cTokenV3).baseToken() == wrappedNativeToken,
            "supplyBaseETH",
            "wrong cTokenV3"
        );
        _requireMsg(amount != 0, "supplyBaseETH", "zero amount");

        amount = _getBalance(NATIVE_TOKEN_ADDRESS, amount);
        IWrappedNativeToken(wrappedNativeToken).deposit{value: amount}();
        uint256 initBal = IComet(cTokenV3).balanceOf(address(this));
        _supply(
            cTokenV3,
            address(this), // to
            wrappedNativeToken,
            amount
        );
        amountOut = IComet(cTokenV3).balanceOf(address(this)) - initBal;
        _updateToken(cTokenV3);
    }

    // No cToken for supplying collateral
    function supplyCollateral(
        address cTokenV3,
        address collateral,
        uint256 amount
    ) external payable {
        _requireMsg(
            IComet(cTokenV3).baseToken() != collateral,
            "supplyCollateral",
            "wrong collateral"
        );
        _requireMsg(amount != 0, "supplyCollateral", "zero amount");

        amount = _getBalance(collateral, amount);
        _supply(
            cTokenV3,
            msg.sender, // to
            collateral,
            amount
        );
    }

    function supplyCollateralETH(
        address cTokenV3,
        uint256 amount
    ) external payable {
        _requireMsg(
            IComet(cTokenV3).baseToken() != wrappedNativeToken,
            "supplyCollateralETH",
            "wrong cTokenV3"
        );
        _requireMsg(amount != 0, "supplyCollateralETH", "zero amount");

        amount = _getBalance(NATIVE_TOKEN_ADDRESS, amount);
        IWrappedNativeToken(wrappedNativeToken).deposit{value: amount}();
        _supply(
            cTokenV3,
            msg.sender, // to
            wrappedNativeToken,
            amount
        );
    }

    // The same entry for withdraw and borrow
    function withdrawBase(
        address cTokenV3,
        uint256 amount
    ) external payable returns (uint256 withdrawAmount) {
        _requireMsg(amount != 0, "withdrawBase", "zero amount");
        // No _getBalance because the amount is for base token instead of cTokenV3
        address baseToken = IComet(cTokenV3).baseToken();
        withdrawAmount = _withdraw(
            cTokenV3,
            address(this), // from
            baseToken,
            amount
        );
        _updateToken(baseToken);
    }

    function withdrawBaseETH(
        address cTokenV3,
        uint256 amount
    ) external payable returns (uint256 withdrawAmount) {
        _requireMsg(
            IComet(cTokenV3).baseToken() == wrappedNativeToken,
            "withdrawBaseETH",
            "wrong cTokenV3"
        );
        _requireMsg(amount != 0, "withdrawBaseETH", "zero amount");
        // No _getBalance because the amount is for base token instead of cTokenV3
        withdrawAmount = _withdraw(
            cTokenV3,
            address(this), // from
            wrappedNativeToken,
            amount
        );
        IWrappedNativeToken(wrappedNativeToken).withdraw(withdrawAmount);
    }

    function withdrawCollateral(
        address cTokenV3,
        address collateral,
        uint256 amount
    ) external payable returns (uint256 withdrawAmount) {
        _requireMsg(
            IComet(cTokenV3).baseToken() != collateral,
            "withdrawCollateral",
            "wrong collateral"
        );
        _requireMsg(amount != 0, "withdrawCollateral", "zero amount");

        withdrawAmount = _withdraw(
            cTokenV3,
            msg.sender, // from
            collateral,
            amount
        );
        _updateToken(collateral);
    }

    function withdrawCollateralETH(
        address cTokenV3,
        uint256 amount
    ) external payable returns (uint256 withdrawAmount) {
        _requireMsg(
            IComet(cTokenV3).baseToken() != wrappedNativeToken,
            "withdrawCollateralETH",
            "wrong cTokenV3"
        );
        _requireMsg(amount != 0, "withdrawCollateralETH", "zero amount");

        withdrawAmount = _withdraw(
            cTokenV3,
            msg.sender, // from
            wrappedNativeToken,
            amount
        );
        IWrappedNativeToken(wrappedNativeToken).withdraw(withdrawAmount);
    }

    function borrow(
        address cTokenV3,
        uint256 amount
    ) external payable returns (uint256 borrowAmount) {
        _requireMsg(amount != 0, "borrow", "zero amount");

        address baseToken = IComet(cTokenV3).baseToken();
        borrowAmount = _withdraw(
            cTokenV3,
            msg.sender, // from
            baseToken,
            amount
        );
        _updateToken(baseToken);
    }

    function borrowETH(
        address cTokenV3,
        uint256 amount
    ) external payable returns (uint256 borrowAmount) {
        _requireMsg(
            IComet(cTokenV3).baseToken() == wrappedNativeToken,
            "borrowETH",
            "wrong cTokenV3"
        );
        _requireMsg(amount != 0, "borrowETH", "zero amount");

        borrowAmount = _withdraw(
            cTokenV3,
            msg.sender, // from
            wrappedNativeToken,
            amount
        );
        IWrappedNativeToken(wrappedNativeToken).withdraw(borrowAmount);
    }

    function repay(address cTokenV3, uint256 amount) external payable {
        _requireMsg(amount != 0, "repay", "zero amount");

        address asset = IComet(cTokenV3).baseToken();
        amount = _getBalance(asset, amount);
        _supply(
            cTokenV3,
            msg.sender, // to
            asset,
            amount
        );
    }

    function repayETH(address cTokenV3, uint256 amount) external payable {
        _requireMsg(
            IComet(cTokenV3).baseToken() == wrappedNativeToken,
            "repayETH",
            "wrong cTokenV3"
        );
        _requireMsg(amount != 0, "repayETH", "zero amount");

        amount = _getBalance(NATIVE_TOKEN_ADDRESS, amount);
        IWrappedNativeToken(wrappedNativeToken).deposit{value: amount}();
        _supply(
            cTokenV3,
            msg.sender, // to
            wrappedNativeToken,
            amount
        );
    }

    /* ========== INTERNAL FUNCTIONS ========== */

    function _supply(
        address comet,
        address dst,
        address asset,
        uint256 amount
    ) internal {
        _tokenApprove(asset, comet, amount);
        try IComet(comet).supplyTo(dst, asset, amount) {} catch Error(
            string memory reason
        ) {
            _revertMsg("supply", reason);
        } catch {
            _revertMsg("supply");
        }
        _tokenApproveZero(asset, comet);
    }

    function _withdraw(
        address comet,
        address from,
        address asset,
        uint256 amount
    ) internal returns (uint256 withdrawAmount) {
        uint256 beforeBalance = IERC20(asset).balanceOf(address(this));
        try
            IComet(comet).withdrawFrom(
                from,
                address(this), // to
                asset,
                amount
            )
        {
            withdrawAmount =
                IERC20(asset).balanceOf(address(this)) -
                beforeBalance;
        } catch Error(string memory reason) {
            _revertMsg("withdraw", reason);
        } catch {
            _revertMsg("withdraw");
        }
    }
}
