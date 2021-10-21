// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

contract Faucet {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    fallback() external payable {}

    receive() external payable {}

    function drain() external payable {
        uint256 give = msg.value.mul(2);
        payable(msg.sender).transfer(give);
    }

    function drainToken(address token, uint256 amount) external {
        uint256 give = amount * 2;
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        IERC20(token).safeTransfer(msg.sender, give);
    }
}
