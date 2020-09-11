pragma solidity ^0.5.0;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "../HandlerBase.sol";
import "./IOasisDirectProxy.sol";

contract HOasis is HandlerBase {
    using SafeERC20 for IERC20;

    address constant MAKER_OTC = 0x794e6e91555438aFc3ccF1c5076A74F42133d08D;
    address constant OASIS_DIRECT_PROXY = 0x793EbBe21607e4F04788F89c7a9b97320773Ec59;

    // Fixed Input - Token to Token
    function sellAllAmount(
        address payToken,
        uint256 payAmt,
        address buyToken,
        uint256 minBuyAmt
    ) external payable returns (uint256 buyAmt) {
        IOasisDirectProxy oasis = IOasisDirectProxy(OASIS_DIRECT_PROXY);
        IERC20(payToken).safeApprove(address(oasis), payAmt);
        buyAmt = oasis.sellAllAmount(
            MAKER_OTC,
            payToken,
            payAmt,
            buyToken,
            minBuyAmt
        );
        IERC20(payToken).safeApprove(address(oasis), 0);

        _updateToken(buyToken);
    }

    // Fixed Input - ETH to Token
    function sellAllAmountPayEth(
        uint256 value,
        address wethToken,
        address buyToken,
        uint256 minBuyAmt
    ) external payable returns (uint256 buyAmt) {
        IOasisDirectProxy oasis = IOasisDirectProxy(OASIS_DIRECT_PROXY);
        buyAmt = oasis.sellAllAmountPayEth.value(value)(
            MAKER_OTC,
            wethToken,
            buyToken,
            minBuyAmt
        );

        _updateToken(buyToken);
    }

    // Fixed Input - Token to ETH
    function sellAllAmountBuyEth(
        address payToken,
        uint256 payAmt,
        address wethToken,
        uint256 minBuyAmt
    ) external payable returns (uint256 wethAmt) {
        IOasisDirectProxy oasis = IOasisDirectProxy(OASIS_DIRECT_PROXY);
        IERC20(payToken).safeApprove(address(oasis), payAmt);
        wethAmt = oasis.sellAllAmountBuyEth(
            MAKER_OTC,
            payToken,
            payAmt,
            wethToken,
            minBuyAmt
        );
        IERC20(payToken).safeApprove(address(oasis), 0);
    }

    // Fixed Output - Token to Token
    function buyAllAmount(
        address buyToken,
        uint256 buyAmt,
        address payToken,
        uint256 maxPayAmt
    ) external payable returns (uint256 payAmt) {
        IOasisDirectProxy oasis = IOasisDirectProxy(OASIS_DIRECT_PROXY);
        IERC20(payToken).safeApprove(address(oasis), maxPayAmt);
        payAmt = oasis.buyAllAmount(
            MAKER_OTC,
            buyToken,
            buyAmt,
            payToken,
            maxPayAmt
        );
        IERC20(payToken).safeApprove(address(oasis), 0);

        _updateToken(buyToken);
    }

    // Fixed Output - ETH to Token
    function buyAllAmountPayEth(
        uint256 value,
        address buyToken,
        uint256 buyAmt,
        address wethToken
    ) external payable returns (uint256 wethAmt) {
        IOasisDirectProxy oasis = IOasisDirectProxy(OASIS_DIRECT_PROXY);
        wethAmt = oasis.buyAllAmountPayEth.value(value)(
            MAKER_OTC,
            buyToken,
            buyAmt,
            wethToken
        );

        _updateToken(buyToken);
    }

    // Fixed Output - Token to ETH
    function buyAllAmountBuyEth(
        address wethToken,
        uint256 wethAmt,
        address payToken,
        uint256 maxPayAmt
    ) external payable returns (uint256 payAmt) {
        IOasisDirectProxy oasis = IOasisDirectProxy(OASIS_DIRECT_PROXY);
        IERC20(payToken).safeApprove(address(oasis), maxPayAmt);
        payAmt = oasis.buyAllAmountBuyEth(
            MAKER_OTC,
            wethToken,
            wethAmt,
            payToken,
            maxPayAmt
        );
        IERC20(payToken).safeApprove(address(oasis), 0);
    }
}
