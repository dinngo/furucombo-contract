pragma solidity ^0.5.0;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "../HandlerBase.sol";

contract HERC20TokenIn is HandlerBase {
    using SafeERC20 for IERC20;

    function inject(address token, uint256 amount) external {
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        // Update involved token
        _updateToken(token);
    }
}
