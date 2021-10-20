pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./IOneInchCaller.sol";

interface IOneInchExchangeV2 {
    struct SwapDescription {
        IERC20 srcToken;
        IERC20 dstToken;
        address srcReceiver;
        address dstReceiver;
        uint256 amount;
        uint256 minReturnAmount;
        uint256 guaranteedAmount;
        uint256 flags;
        address referrer;
        bytes permit;
    }

    function discountedSwap(
        IOneInchCaller caller,
        SwapDescription calldata desc,
        IOneInchCaller.CallDescription[] calldata calls
    ) external payable returns (uint256 returnAmount);

    function swap(
        IOneInchCaller caller,
        SwapDescription calldata desc,
        IOneInchCaller.CallDescription[] calldata calls
    ) external payable returns (uint256 returnAmount);
}
