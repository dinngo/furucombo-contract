// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./IAggregationExecutor.sol";

interface IAggregationRouterV3 {
    struct SwapDescriptionV3 {
        IERC20 srcToken;
        IERC20 dstToken;
        address srcReceiver;
        address dstReceiver;
        uint256 amount;
        uint256 minReturnAmount;
        uint256 flags;
        bytes permit;
    }

    function discountedSwap(
        IAggregationExecutor caller,
        SwapDescriptionV3 calldata desc,
        bytes calldata data
    )
    external
    payable
    returns (uint256 returnAmount, uint256 gasLeft, uint256 chiSpent);

    function swap(
        IAggregationExecutor caller,
        SwapDescriptionV3 calldata desc,
        bytes calldata data
    )
        external
        payable
        returns (uint256 returnAmount, uint256 gasLeft);

    function unoswap(
        IERC20 srcToken,
        uint256 amount,
        uint256 minReturn,
        bytes32[] calldata /* pools */
    ) external payable returns (uint256 returnAmount);
}
