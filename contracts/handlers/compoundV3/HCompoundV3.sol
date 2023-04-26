// SPDX-License-Identifier: MIT

pragma solidity 0.8.10;

import "../HandlerBase.sol";
import "../wrappednativetoken/IWrappedNativeToken.sol";
import "./IComet.sol";

contract HCompoundV3 is HandlerBase {
    address public immutable wrappedNativeToken;

    constructor(address wrappedNativeToken_) {
        wrappedNativeToken = wrappedNativeToken_;
    }

    function getContractName() public pure override returns (string memory) {
        return "HCompoundV3";
    }

    // The same entry for supply and repay
    function supply(
        address comet,
        address onBehalf,
        address asset,
        uint256 amount
    ) external payable {
        amount = _getBalance(asset, amount);
        _supply(comet, onBehalf, asset, amount);
    }

    function supplyETH(
        address comet,
        address onBehalf,
        uint256 amount
    ) external payable {
        amount = _getBalance(NATIVE_TOKEN_ADDRESS, amount);
        IWrappedNativeToken(wrappedNativeToken).deposit{value: amount}();
        _supply(comet, onBehalf, wrappedNativeToken, amount);
        _updateToken(wrappedNativeToken);
    }

    // The same entry for withdraw and borrow
    function withdraw(
        address comet,
        address onBehalf,
        address asset,
        uint256 amount
    ) external payable returns (uint256 withdrawAmount) {
        withdrawAmount = _withdraw(comet, onBehalf, asset, amount);
        _updateToken(asset);
    }

    function withdrawETH(
        address comet,
        address onBehalf,
        uint256 amount
    ) external payable returns (uint256 withdrawAmount) {
        withdrawAmount = _withdraw(comet, onBehalf, wrappedNativeToken, amount);
        IWrappedNativeToken(wrappedNativeToken).withdraw(withdrawAmount);
    }

    /* ========== INTERNAL FUNCTIONS ========== */

    function _supply(
        address comet,
        address onBehalf,
        address asset,
        uint256 amount
    ) internal {
        _tokenApprove(asset, comet, amount);
        try IComet(comet).supplyTo(onBehalf, asset, amount) {} catch Error(
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
        address onBehalf,
        address asset,
        uint256 amount
    ) internal returns (uint256 withdrawAmount) {
        uint256 beforeBalance = IERC20(asset).balanceOf(address(this));
        try IComet(comet).withdrawFrom(onBehalf, address(this), asset, amount) {
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
