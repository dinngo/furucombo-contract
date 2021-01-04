pragma solidity ^0.6.0;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "../HandlerBase.sol";
import "./IOasisDirectProxy.sol";

contract HOasis is HandlerBase {
    using SafeERC20 for IERC20;

    // prettier-ignore
    address public constant MAKER_OTC = 0x794e6e91555438aFc3ccF1c5076A74F42133d08D;
    // prettier-ignore
    address public constant OASIS_DIRECT_PROXY = 0x793EbBe21607e4F04788F89c7a9b97320773Ec59;

    function getContractName() public pure override returns (string memory) {
        return "HOasis";
    }

    // Fixed Input - Token to Token
    function sellAllAmount(
        address payToken,
        uint256 payAmt,
        address buyToken,
        uint256 minBuyAmt
    ) external payable returns (uint256 buyAmt) {
        IOasisDirectProxy oasis = IOasisDirectProxy(OASIS_DIRECT_PROXY);
        // if amount == uint256(-1) return balance of Proxy
        payAmt = _getProxyBalance(payToken, payAmt);
        IERC20(payToken).safeApprove(address(oasis), payAmt);
        try
            oasis.sellAllAmount(
                MAKER_OTC,
                payToken,
                payAmt,
                buyToken,
                minBuyAmt
            )
        returns (uint256 ret) {
            buyAmt = ret;
        } catch Error(string memory reason) {
            _revertMsg("sellAllAmount", reason);
        } catch {
            _revertMsg("sellAllAmount");
        }
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
        // if amount == uint256(-1) return balance of Proxy
        value = _getProxyBalance(address(0), value);
        try
            oasis.sellAllAmountPayEth{value: value}(
                MAKER_OTC,
                wethToken,
                buyToken,
                minBuyAmt
            )
        returns (uint256 ret) {
            buyAmt = ret;
        } catch Error(string memory reason) {
            _revertMsg("sellAllAmountPayEth", reason);
        } catch {
            _revertMsg("sellAllAmountPayEth");
        }

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
        // if amount == uint256(-1) return balance of Proxy
        payAmt = _getProxyBalance(payToken, payAmt);
        IERC20(payToken).safeApprove(address(oasis), payAmt);
        try
            oasis.sellAllAmountBuyEth(
                MAKER_OTC,
                payToken,
                payAmt,
                wethToken,
                minBuyAmt
            )
        returns (uint256 ret) {
            wethAmt = ret;
        } catch Error(string memory reason) {
            _revertMsg("sellAllAmountBuyEth", reason);
        } catch {
            _revertMsg("sellAllAmountBuyEth");
        }
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
        try
            oasis.buyAllAmount(MAKER_OTC, buyToken, buyAmt, payToken, maxPayAmt)
        returns (uint256 ret) {
            payAmt = ret;
        } catch Error(string memory reason) {
            _revertMsg("buyAllAmount", reason);
        } catch {
            _revertMsg("buyAllAmount");
        }
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
        try
            oasis.buyAllAmountPayEth{value: value}(
                MAKER_OTC,
                buyToken,
                buyAmt,
                wethToken
            )
        returns (uint256 ret) {
            wethAmt = ret;
        } catch Error(string memory reason) {
            _revertMsg("buyAllAmountPayEth", reason);
        } catch {
            _revertMsg("buyAllAmountPayEth");
        }

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
        try
            oasis.buyAllAmountBuyEth(
                MAKER_OTC,
                wethToken,
                wethAmt,
                payToken,
                maxPayAmt
            )
        returns (uint256 ret) {
            payAmt = ret;
        } catch Error(string memory reason) {
            _revertMsg("buyAllAmountBuyEth", reason);
        } catch {
            _revertMsg("buyAllAmountBuyEth");
        }
        IERC20(payToken).safeApprove(address(oasis), 0);
    }
}
