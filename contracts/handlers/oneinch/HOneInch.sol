pragma solidity ^0.6.0;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "../HandlerBase.sol";
import "./IOneInchExchange.sol";

contract HOneInch is HandlerBase {
    using SafeERC20 for IERC20;

    // prettier-ignore
    address public constant ONEINCH_PROXY = 0x11111254369792b2Ca5d084aB5eEA397cA8fa48B;
    // prettier-ignore
    address public constant TOKEN_SPENDER = 0xE4C9194962532fEB467DCe8b3d42419641c6eD2E;
    // prettier-ignore
    address public constant REFERRER = 0xBcb909975715DC8fDe643EE44b89e3FD6A35A259;
    // prettier-ignore
    address public constant ETH_ADDRESS = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    function swap(
        IERC20 fromToken,
        IERC20 toToken,
        uint256 fromTokenAmount,
        uint256 minReturnAmount,
        uint256 guaranteedAmount,
        address referrer,
        address[] memory callAddresses,
        bytes memory callDataConcat,
        uint256[] memory starts,
        uint256[] memory gasLimitsAndValues
    ) public payable returns (uint256 returnAmount) {
        require(
            address(fromToken) != address(toToken),
            "attemp to swap to same token"
        );

        if (address(fromToken) == ETH_ADDRESS) {
            returnAmount = IOneInchExchange(ONEINCH_PROXY).swap.value(
                fromTokenAmount
            )(
                fromToken,
                toToken,
                fromTokenAmount,
                minReturnAmount,
                guaranteedAmount,
                REFERRER,
                callAddresses,
                callDataConcat,
                starts,
                gasLimitsAndValues
            );
        } else {
            IERC20(fromToken).safeApprove(TOKEN_SPENDER, fromTokenAmount);
            returnAmount = IOneInchExchange(ONEINCH_PROXY).swap(
                fromToken,
                toToken,
                fromTokenAmount,
                minReturnAmount,
                guaranteedAmount,
                REFERRER,
                callAddresses,
                callDataConcat,
                starts,
                gasLimitsAndValues
            );
            IERC20(fromToken).safeApprove(TOKEN_SPENDER, 0);
        }

        if (address(toToken) != ETH_ADDRESS) {
            _updateToken(address(toToken));
        }
    }
}
