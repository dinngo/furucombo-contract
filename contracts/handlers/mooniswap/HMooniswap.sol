pragma solidity ^0.5.0;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "../HandlerBase.sol";
import "./IMooniFactory.sol";
import "./IMooniswap.sol";


contract HMooniswap is HandlerBase {
    using SafeERC20 for IERC20;

    address payable public constant MooniFactory = 0x71CD6666064C3A1354a3B4dca5fA1E2D3ee7D303;

    function deposit(
        address[] calldata tokens,
        uint256[] calldata amounts,
        uint256[] calldata minAmounts
    ) external payable returns (uint256 fairSupply) {
        require(tokens.length == 2, "wrong tokens length");
        require(amounts.length == 2, "wrong amounts length");
        require(minAmounts.length == 2, "wrong min amounts length");
        IMooniFactory factory = IMooniFactory(MooniFactory);
        IMooniswap mooniswap = IMooniswap(factory.pools(tokens[0], tokens[1]));

        // Approve token
        uint256 value = 0;
        for (uint256 i = 0; i < tokens.length; i++) {
            if (tokens[i] == address(0)) {
                value = value + amounts[i];
            } else {
                IERC20(tokens[i]).safeApprove(address(mooniswap), amounts[i]);
            }
        }

        // Add liquidity
        fairSupply = mooniswap.deposit.value(value)(amounts, minAmounts);

        // Approve token 0
        for (uint256 i = 0; i < tokens.length; i++) {
            if (tokens[i] != address(0)) {
                IERC20(tokens[i]).safeApprove(address(mooniswap), 0);
            }
        }

        _updateToken(address(mooniswap));
    }

    function withdraw(
        address pool,
        uint256 amount,
        uint256[] calldata minReturns
    ) external payable {
        // Get mooniswap
        IMooniswap mooniswap = IMooniswap(pool);

        // Remove liquidity
        mooniswap.withdraw(amount, minReturns);

        // Update involved token except ETH
        address[] memory tokens = mooniswap.getTokens();
        for (uint256 i = 0; i < tokens.length; i++) {
            if (tokens[i] != address(0)) {
                _updateToken(address(tokens[i]));
            }
        }
    }
}
