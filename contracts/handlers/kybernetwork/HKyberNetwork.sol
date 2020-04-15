pragma solidity ^0.5.0;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "../HandlerBase.sol";
import "./IKyberNetworkProxy.sol";

contract HKyberNetwork is HandlerBase {
    using SafeERC20 for IERC20;

    address constant ETH_TOKEN_ADDRESS = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;
    address constant KYBERNETWORK_PROXY = 0x818E6FECD516Ecc3849DAf6845e3EC868087B755;

    function swapEtherToToken(
        uint256 value,
        address token,
        uint256 minRate
    ) external payable returns (uint256 destAmount) {
        IKyberNetworkProxy kyber = IKyberNetworkProxy(KYBERNETWORK_PROXY);
        destAmount = kyber.swapEtherToToken.value(value)(IERC20(token), minRate);

        // Update involved token
        _updateToken(token);
    }

    function swapTokenToEther(
        address token,
        uint256 tokenQty,
        uint256 minRate
    ) external payable returns (uint256 destAmount) {
        IKyberNetworkProxy kyber = IKyberNetworkProxy(KYBERNETWORK_PROXY);
        IERC20(token).safeApprove(address(kyber), tokenQty);
        destAmount = kyber.swapTokenToEther(IERC20(token), tokenQty, minRate);
        IERC20(token).safeApprove(address(kyber), 0);
    }

    function swapTokenToToken(
        address srcToken,
        uint256 srcQty,
        address destToken,
        uint256 minRate
    ) external payable returns (uint256 destAmount) {
        IKyberNetworkProxy kyber = IKyberNetworkProxy(KYBERNETWORK_PROXY);
        IERC20(srcToken).safeApprove(address(kyber), srcQty);
        destAmount = kyber.swapTokenToToken(
            IERC20(srcToken),
            srcQty,
            IERC20(destToken),
            minRate
        );
        IERC20(srcToken).safeApprove(address(kyber), 0);

        // Update involved token
        _updateToken(destToken);
    }
}
