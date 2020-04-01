pragma solidity ^0.5.0;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "../HandlerBase.sol";
import "./IKyberNetworkProxy.sol";

contract HKyberswap is HandlerBase {
    using SafeERC20 for IERC20;

    address ETH_TOKEN_ADDRESS = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    function getProxy() public pure returns (address) {
        return 0x818E6FECD516Ecc3849DAf6845e3EC868087B755;
    }

    function swapEtherToToken(
        uint256 value,
        address token,
        uint256 minRate
    ) external payable returns (uint256 destAmount) {
        //uint256 minRate;
        IKyberNetworkProxy kyber = IKyberNetworkProxy(getProxy());
        //(, minRate) = kyber.getExpectedRate(IERC20(ETH_TOKEN_ADDRESS), IERC20(token), value);
        destAmount = kyber.swapEtherToToken.value(value)(IERC20(token), minRate);

        // Update involved token
        _updateToken(token);
    }
}
