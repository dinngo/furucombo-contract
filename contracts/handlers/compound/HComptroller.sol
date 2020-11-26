pragma solidity ^0.6.0;

import "../HandlerBase.sol";
import "./IComptroller.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

contract HComptroller is HandlerBase {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;
    address constant COMPTROLLER = 0x3d9819210A31b4961b30EF54bE2aeD79B9c9Cd3B;

    function getContractName() public override pure returns (string memory) {
        return "HComptroller";
    }

    function claimComp() external payable returns (uint256) {
        IComptroller comptroller = IComptroller(COMPTROLLER);
        address comp = comptroller.getCompAddress();
        address sender = cache.getSender();

        uint256 beforeCompBalance = IERC20(comp).balanceOf(sender);
        try comptroller.claimComp(sender)  {} catch Error(
            string memory reason
        ) {
            _revertMsg("claimComp", reason);
        } catch {
            _revertMsg("claimComp");
        }
        uint256 afterCompBalance = IERC20(comp).balanceOf(sender);

        return afterCompBalance.sub(beforeCompBalance);
    }

    function claimComp(address holder) external payable returns (uint256) {
        IComptroller comptroller = IComptroller(COMPTROLLER);
        address comp = comptroller.getCompAddress();

        uint256 beforeCompBalance = IERC20(comp).balanceOf(holder);
        try comptroller.claimComp(holder)  {} catch Error(
            string memory reason
        ) {
            _revertMsg("claimComp", reason);
        } catch {
            _revertMsg("claimComp");
        }
        uint256 afterCompBalance = IERC20(comp).balanceOf(holder);

        return afterCompBalance.sub(beforeCompBalance);
    }
}
