pragma solidity ^0.6.0;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "../HandlerBase.sol";
import "./IYVault.sol";

contract HYVault is HandlerBase {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    function getContractName() public override pure returns (string memory) {
        return "HYVault";
    }

    function deposit(address vault, uint256 _amount)
        external
        payable
        returns (uint256)
    {
        IYVault yVault = IYVault(vault);
        uint256 beforeYTokenBalance = IERC20(address(yVault)).balanceOf(
            address(this)
        );

        address token = yVault.token();
        IERC20(token).safeApprove(address(yVault), _amount);
        try yVault.deposit(_amount)  {} catch Error(string memory reason) {
            _revertMsg("deposit", reason);
        } catch {
            _revertMsg("deposit");
        }
        IERC20(token).safeApprove(address(yVault), 0);

        uint256 afterYTokenBalance = IERC20(address(yVault)).balanceOf(
            address(this)
        );

        _updateToken(address(yVault));
        return afterYTokenBalance.sub(beforeYTokenBalance);
    }

    function depositETH(uint256 value, address vault)
        external
        payable
        returns (uint256)
    {
        IYVault yVault = IYVault(vault);
        uint256 beforeYTokenBalance = IERC20(address(yVault)).balanceOf(
            address(this)
        );
        try yVault.depositETH.value(value)()  {} catch Error(
            string memory reason
        ) {
            _revertMsg("depositETH", reason);
        } catch {
            _revertMsg("depositETH");
        }
        uint256 afterYTokenBalance = IERC20(address(yVault)).balanceOf(
            address(this)
        );

        _updateToken(address(yVault));
        return afterYTokenBalance.sub(beforeYTokenBalance);
    }

    function withdraw(address vault, uint256 _shares)
        external
        payable
        returns (uint256)
    {
        IYVault yVault = IYVault(vault);
        address token = yVault.token();
        uint256 beforeTokenBalance = IERC20(token).balanceOf(address(this));
        try yVault.withdraw(_shares)  {} catch Error(string memory reason) {
            _revertMsg("withdraw", reason);
        } catch {
            _revertMsg("withdraw");
        }
        uint256 afterTokenBalance = IERC20(token).balanceOf(address(this));

        _updateToken(token);
        return afterTokenBalance.sub(beforeTokenBalance);
    }

    function withdrawETH(address vault, uint256 _shares)
        external
        payable
        returns (uint256)
    {
        uint256 beforeETHBalance = address(this).balance;
        IYVault yVault = IYVault(vault);
        try yVault.withdrawETH(_shares)  {} catch Error(string memory reason) {
            _revertMsg("withdrawETH", reason);
        } catch {
            _revertMsg("withdrawETH");
        }
        uint256 afterETHBalance = address(this).balance;
        return afterETHBalance.sub(beforeETHBalance);
    }
}
