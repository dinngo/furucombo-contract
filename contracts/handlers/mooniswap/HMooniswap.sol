pragma solidity ^0.6.0;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

import "../HandlerBase.sol";
import "./IMooniFactory.sol";
import "./IMooniswap.sol";

contract HMooniswap is HandlerBase {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    // prettier-ignore
    address payable public constant MOONIFACTORY = 0x71CD6666064C3A1354a3B4dca5fA1E2D3ee7D303;

    function getContractName() public override pure returns (string memory) {
        return "HMooniswap";
    }

    function deposit(
        address[2] calldata tokens,
        uint256[] calldata amounts,
        uint256[] calldata minAmounts
    ) external payable returns (uint256 fairSupply) {
        if (tokens[0] > tokens[1]) _revertMsg("deposit", "wrong tokens order");
        if (tokens[0] == tokens[1]) _revertMsg("deposit", "same tokens");
        if (amounts.length != tokens.length)
            _revertMsg("deposit", "wrong amounts length");

        IMooniFactory factory = IMooniFactory(MOONIFACTORY);
        IMooniswap mooniswap = IMooniswap(factory.pools(tokens[0], tokens[1]));

        // Approve token
        uint256 value = 0;
        if (tokens[0] == address(0)) {
            value = amounts[0];
        } else {
            IERC20(tokens[0]).safeApprove(address(mooniswap), amounts[0]);
        }
        IERC20(tokens[1]).safeApprove(address(mooniswap), amounts[1]);

        // Add liquidity
        try mooniswap.deposit.value(value)(amounts, minAmounts) returns (
            uint256 ret
        ) {
            fairSupply = ret;
        } catch Error(string memory reason) {
            _revertMsg("deposit", reason);
        } catch {
            _revertMsg("deposit");
        }

        // Approve token 0
        if (tokens[0] != address(0)) {
            IERC20(tokens[0]).safeApprove(address(mooniswap), 0);
        }
        IERC20(tokens[1]).safeApprove(address(mooniswap), 0);

        // Update involved token
        _updateToken(address(mooniswap));
    }

    function withdraw(
        address pool,
        uint256 amount,
        uint256[] calldata minReturns
    ) external payable returns (uint256[] memory) {
        // Get mooniswap
        IMooniswap mooniswap = IMooniswap(pool);
        address[] memory tokens = mooniswap.getTokens();
        uint256[] memory amountsOut = new uint256[](tokens.length);

        for (uint256 i = 0; i < tokens.length; i++) {
            if (tokens[i] != address(0)) {
                amountsOut[i] = IERC20(tokens[i]).balanceOf(address(this));
            } else {
                amountsOut[i] = address(this).balance;
            }
        }

        // Remove liquidity
        try mooniswap.withdraw(amount, minReturns)  {} catch Error(
            string memory reason
        ) {
            _revertMsg("withdraw", reason);
        } catch {
            _revertMsg("withdraw");
        }

        // Update involved token except ETH
        for (uint256 i = 0; i < tokens.length; i++) {
            if (tokens[i] != address(0)) {
                _updateToken(address(tokens[i]));
                amountsOut[i] = IERC20(tokens[i]).balanceOf(address(this)).sub(
                    amountsOut[i]
                );
            } else {
                amountsOut[i] = address(this).balance.sub(amountsOut[i]);
            }
        }
        return amountsOut;
    }
}
