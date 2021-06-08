pragma solidity ^0.6.0;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "../HandlerBase.sol";
import "../weth/IWETH9.sol";
import "./IRootChainManager.sol";
import "./IDepositManager.sol";

contract HPolygon is HandlerBase {
    using SafeERC20 for IERC20;

    // prettier-ignore
    IDepositManager public constant PLASMA_MANAGER = IDepositManager(0x401F6c983eA34274ec46f84D70b31C151321188b);
    // prettier-ignore
    IRootChainManager public constant POS_MANAGER = IRootChainManager(0xA0c68C638235ee32657e8f720a23ceC1bFc77C77);
    // prettier-ignore
    address public constant POS_PREDICATE_ERC20 = 0x40ec5B33f54e0E8A33A975908C5BA1c14e5BbbDf;
    // prettier-ignore
    address public constant MATIC = 0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0;
    // prettier-ignore
    address payable public constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    // prettier-ignore
    address public constant ETH = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    function getContractName() public pure override returns (string memory) {
        return "HPolygon";
    }

    function depositEther(uint256 value) external payable {
        value = _getBalance(address(0), value);
        _depositEther(value);
    }

    function depositERC20(address token, uint256 amount) external payable {
        amount = _getBalance(token, amount);

        if (token == WETH) {
            // Unwrap WETH to ether for consistency
            IWETH9(WETH).withdraw(amount);
            _depositEther(amount);
        } else if (token == MATIC) {
            // Use Plasma bridge for MATIC token
            IERC20(token).safeApprove(address(PLASMA_MANAGER), amount);
            try
                PLASMA_MANAGER.depositERC20ForUser(token, _getSender(), amount)
            {} catch Error(string memory reason) {
                _revertMsg("depositERC20", reason);
            } catch {
                _revertMsg("depositERC20");
            }
        } else {
            // Use PoS bridge for other tokens
            bytes memory depositData = abi.encode("uint256", amount);
            IERC20(token).safeApprove(POS_PREDICATE_ERC20, amount);
            try
                POS_MANAGER.depositFor(_getSender(), token, depositData)
            {} catch Error(string memory reason) {
                _revertMsg("depositERC20", reason);
            } catch {
                _revertMsg("depositERC20");
            }
        }
    }

    function _depositEther(uint256 value) internal {
        // Use PoS bridge for ether
        try
            POS_MANAGER.depositEtherFor{value: value}(_getSender())
        {} catch Error(string memory reason) {
            _revertMsg("depositEther", reason);
        } catch {
            _revertMsg("depositEther");
        }
    }
}
