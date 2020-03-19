pragma solidity ^0.5.0;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "../HandlerBase.sol";
import "./ICToken.sol";

contract HCToken is HandlerBase {
    using SafeERC20 for IERC20;

    function _getToken(address token) internal view returns (address result) {
        return ICToken(token).underlying();
    }

    function mint(address cToken, uint256 amount) external {
        IERC20(_getToken(cToken)).approve(cToken, amount);
        ICToken compound = ICToken(cToken);
        require(compound.mint(amount) != 0, "mint failed");

        // Update involved token
        _updateToken(cToken);
    }
}
