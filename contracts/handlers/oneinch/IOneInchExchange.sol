pragma solidity ^0.5.0;
// pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IOneInchExchange {
    function swap(
        IERC20 fromToken,
        IERC20 toToken,
        uint256 fromTokenAmount,
        uint256 minReturnAmount,
        uint256 guaranteedAmount,
        address referrer,
        address[] calldata callAddresses,
        bytes calldata callDataConcat,
        uint256[] calldata starts,
        uint256[] calldata gasLimitsAndValues
    ) external payable returns(uint256 returnAmount);
}

// interface IOneInchExchange {
//     struct Input {
//         address fromToken;
//         address toToken;
//         uint256 fromTokenAmount;
//         uint256 minReturnAmount;
//         uint256 guaranteedAmount;
//         address referrer;
//         address[] callAddresses;
//         bytes callDataConcat;
//         uint256[] starts;
//         uint256[] gasLimitsAndValues;
//     }

//     function swap(
//         IERC20 fromToken,
//         IERC20 toToken,
//         uint256 fromTokenAmount,
//         uint256 minReturnAmount,
//         uint256 guaranteedAmount,
//         address referrer,
//         address[] calldata callAddresses,
//         bytes calldata callDataConcat,
//         uint256[] calldata starts,
//         uint256[] calldata gasLimitsAndValues
//     ) external payable returns(uint256 returnAmount);
// }
