pragma solidity ^0.6.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IKyberNetworkProxy {
    // Simple interface for Kyber Network
    function swapTokenToToken(
        IERC20 src,
        uint256 srcAmount,
        IERC20 dest,
        uint256 minConversionRate
    ) external returns (uint256);

    function swapEtherToToken(IERC20 token, uint256 minConversionRate)
        external
        payable
        returns (uint256);

    function swapTokenToEther(
        IERC20 token,
        uint256 srcAmount,
        uint256 minConversionRate
    ) external returns (uint256);

    function maxGasPrice() external view returns (uint256);

    function getUserCapInWei(address user) external view returns (uint256);

    function getUserCapInTokenWei(address user, IERC20 token)
        external
        view
        returns (uint256);

    function enabled() external view returns (bool);

    function info(bytes32 id) external view returns (uint256);

    function getExpectedRate(
        IERC20 src,
        IERC20 dest,
        uint256 srcQty
    ) external view returns (uint256 expectedRate, uint256 slippageRate);

    function tradeWithHint(
        IERC20 src,
        uint256 srcAmount,
        IERC20 dest,
        address destAddress,
        uint256 maxDestAmount,
        uint256 minConversionRate,
        address walletId,
        bytes calldata hint
    ) external payable returns (uint256);

    function admin() external view returns (address);
}
