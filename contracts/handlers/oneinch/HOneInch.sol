pragma solidity ^0.5.0;
// pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "../HandlerBase.sol";
import "./IOneInchExchange.sol";


contract HOneInch is HandlerBase {
    using SafeERC20 for IERC20;

    address constant ONEINCH_PROXY = 0x11111254369792b2Ca5d084aB5eEA397cA8fa48B;
    address constant TOKEN_SPENDER = 0xE4C9194962532fEB467DCe8b3d42419641c6eD2E;
    address constant REFERRER = 0xBcb909975715DC8fDe643EE44b89e3FD6A35A259;
    address constant ETH_ADDRESS = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

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
        require(address(fromToken) != address(toToken), "attemp to swap to same token");

        if(address(fromToken) == ETH_ADDRESS){
            returnAmount = IOneInchExchange(ONEINCH_PROXY).swap.value(fromTokenAmount)(
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
        }else{
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

        if(address(toToken) != ETH_ADDRESS){
            _updateToken(address(toToken));
        }
    }

    // function () external payable {
    //     (bool success,) = ONEINCH_PROXY.call.value(msg.value)(msg.data);
    //     require(success, "call failed");
    // }

}

// contract HOneInch is HandlerBase {
//     using SafeERC20 for IERC20;

//     IOneInchExchange constant ONEINCH_PROXY = IOneInchExchange(0x11111254369792b2Ca5d084aB5eEA397cA8fa48B);
//     address constant TOKEN_SPENDER = 0xBcb909975715DC8fDe643EE44b89e3FD6A35A259;
//     address constant REFERRER = 0xBcb909975715DC8fDe643EE44b89e3FD6A35A259;
//     address constant ETH_ADDRESS = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

//     function swap(
//         IOneInchExchange.Input memory input
//     ) public payable returns (uint256 returnAmount) {
//         require(input.fromToken != input.toToken, "attemp to swap to same token");

//         if(input.fromToken == ETH_ADDRESS){
//             returnAmount = ONEINCH_PROXY.swap.value(input.fromTokenAmount)(
//                 input.fromToken,
//                 input.toToken,
//                 input.fromTokenAmount,
//                 input.minReturnAmount,
//                 input.guaranteedAmount,
//                 input.referrer,
//                 input.callAddresses,
//                 input.callDataConcat,
//                 input.starts,
//                 input.gasLimitsAndValues
//             );
//         }
//         // else{
//         //     IERC20(fromToken).safeApprove(TOKEN_SPENDER, fromTokenAmount);
//         //     returnAmount = IOneInchExchange(ONEINCH_PROXY).swap(
//         //         fromToken,
//         //         toToken,
//         //         fromTokenAmount,
//         //         minReturnAmount,
//         //         guaranteedAmount,
//         //         REFERRER,
//         //         callAddresses,
//         //         callDataConcat,
//         //         starts,
//         //         gasLimitsAndValues
//         //     );
//         //     IERC20(fromToken).safeApprove(TOKEN_SPENDER, 0);
//         // }

//         if(input.toToken != ETH_ADDRESS){
//             _updateToken(input.toToken);
//         }
//     }

// }

// contract HOneInch is HandlerBase {
//     using SafeERC20 for IERC20;

//     address constant ONEINCH_PROXY = 0x11111254369792b2Ca5d084aB5eEA397cA8fa48B;
//     address constant TOKEN_SPENDER = 0xBcb909975715DC8fDe643EE44b89e3FD6A35A259;
//     address constant REFERRER = 0xBcb909975715DC8fDe643EE44b89e3FD6A35A259;
//     address constant ETH_ADDRESS = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

//     // struct Input {
//     //     IERC20 fromToken;
//     //     IERC20 toToken;
//     //     uint256 fromTokenAmount;
//     //     uint256 minReturnAmount;
//     //     uint256 guaranteedAmount;
//     //     address referrer;
//     //     address[] callAddresses;
//     //     bytes callDataConcat;
//     //     uint256[] starts;
//     //     uint256[] gasLimitsAndValues;
//     // }

//     function swap(
//         IOneInchExchange.Input memory input
//     ) public payable returns (uint256 returnAmount) {
//         require(address(input.fromToken) != address(input.toToken), "attemp to swap to same token");
//         input.referrer = REFERRER;

//         if(address(input.fromToken) == ETH_ADDRESS){
//             returnAmount = IOneInchExchange(ONEINCH_PROXY).swap.value(input.fromTokenAmount)(
//                 input
//             );
//         }else{
//             IERC20(input.fromToken).safeApprove(TOKEN_SPENDER, input.fromTokenAmount);
//             returnAmount = IOneInchExchange(ONEINCH_PROXY).swap(
//                 input
//             );
//             IERC20(input.fromToken).safeApprove(TOKEN_SPENDER, 0);
//         }

//         if(address(input.toToken) != ETH_ADDRESS){
//             _updateToken(address(input.toToken));
//         }
//     }

// }
