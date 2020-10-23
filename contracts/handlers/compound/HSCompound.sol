pragma solidity ^0.5.0;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "../HandlerBase.sol";
import "../maker/IDSProxy.sol";
import "../compound/ICToken.sol";

contract HSCompound is HandlerBase {
    using SafeERC20 for IERC20;

    address constant PROXY_REGISTRY = 0x4678f0a6958e4D2Bc4F1BAF7Bc52E8F3564f3fE4;
    address constant FCOMPOUND_ACTIONS = address(0xbeef); // TODO: predict and fill
    address constant ETH_ADDRESS = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;
    address constant CETH_ADDRESS = 0x4Ddc2D193948926D02f9B1fE9e1daa0718270ED5;

    modifier isDSProxyOwner(address dsProxy) {
        address sender = cache.getSender();
        require(
            IDSProxy(dsProxy).owner() == sender,
            "Not owner of the DSProxy"
        );
        _;
    }

    // function depositToken(
    //     address dsProxy,
    //     address token,
    //     uint256 amount,
    //     bool isCTokenAndEnterMarket
    // ) public payable isDSProxyOwner(dsProxy) {
    //     _depositToken(dsProxy, token, amount, isCTokenAndEnterMarket);
    // }

    // function withdrawToken(
    //     address dsProxy,
    //     address token,
    //     uint256 amount
    // ) public payable isDSProxyOwner(dsProxy) {
    //     _withdrawToken(dsProxy, token, amount);
    // }

    //TODO: enterMarket interface
    //TODO: enterMarkets interface

    function borrow(
        address dsProxy,
        address cTokenIn,
        address cTokenBorrow,
        uint256 cAmountIn,
        uint256 uBorrowAmount,
        bool enterMarket
    ) external payable isDSProxyOwner(dsProxy) {
        if (cAmountIn > 0) {
            _depositToken(dsProxy, cTokenIn, cAmountIn);
        }

        if (enterMarket) {
            _enterMarket(dsProxy, cTokenIn);
        }

        if (uBorrowAmount > 0) {
            address underlying;
            if (cTokenBorrow == CETH_ADDRESS) {
                underlying = ETH_ADDRESS;
            } else {
                underlying = _getToken(cTokenBorrow);
            }
            // Execute borrow, borrowed token will stay in the DSProxy
            IDSProxy(dsProxy).execute(
                FCOMPOUND_ACTIONS,
                abi.encodeWithSelector(
                    // selector of "borrow(address,uint256)"
                    0x4b8a3529,
                    cTokenBorrow,
                    uBorrowAmount
                )
            );
            // Withdraw borrowed token from the DSProxy
            _withdrawToken(dsProxy, underlying, uBorrowAmount);

            // Update borrowed token
            if (underlying != ETH_ADDRESS) _updateToken(underlying);
        }
    }

    function repayBorrow(
        address dsProxy,
        address cTokenRepay,
        address cTokenWithdraw,
        uint256 uRepayAmount,
        uint256 cWithdrawAmount
    ) external payable isDSProxyOwner(dsProxy) {
        // Execute repay only when `uRepayAmount` is greater than 0
        if (uRepayAmount > 0) {
            if (cTokenRepay == CETH_ADDRESS) {
                // Execute ether repay
                IDSProxy(dsProxy).execute.value(uRepayAmount)(
                    FCOMPOUND_ACTIONS,
                    abi.encodeWithSelector(
                        // selector of "repayBorrow(address,uint256)"
                        0xabdb5ea8,
                        cTokenRepay,
                        uRepayAmount
                    )
                );
            } else {
                // Approve repay token to DSProxy
                address underlying = _getToken(cTokenRepay);
                IERC20(underlying).safeApprove(dsProxy, uRepayAmount);
                // Execute token repay
                IDSProxy(dsProxy).execute(
                    FCOMPOUND_ACTIONS,
                    abi.encodeWithSelector(
                        // selector of "repayBorrow(address,uint256)"
                        0xabdb5ea8,
                        cTokenRepay,
                        uRepayAmount
                    )
                );
                IERC20(underlying).safeApprove(dsProxy, 0);
            }
        }

        if (cWithdrawAmount > 0) {
            // Withdraw borrowed token from DSProxy
            _withdrawToken(dsProxy, cTokenWithdraw, cWithdrawAmount);
            // Update borrowed token
            _updateToken(cTokenWithdraw);
        }
    }

    function _depositToken(
        address dsProxy,
        address token,
        uint256 amount
    ) internal {
        IERC20(token).safeTransfer(dsProxy, amount);
    }

    function _withdrawToken(
        address dsProxy,
        address token,
        uint256 amount
    ) internal {
        IDSProxy(dsProxy).execute(
            FCOMPOUND_ACTIONS,
            abi.encodeWithSelector(
                // selector of "withdraw(address,uint256)"
                0xf3fef3a3,
                token,
                amount
            )
        );
    }

    function _enterMarket(address dsProxy, address cToken) internal {
        IDSProxy(dsProxy).execute(
            FCOMPOUND_ACTIONS,
            abi.encodeWithSelector(
                // selector of "enterMarket(address)"
                0x3fe5d425,
                cToken
            )
        );
    }

    function _getToken(address token) internal view returns (address) {
        return ICToken(token).underlying();
    }
}
