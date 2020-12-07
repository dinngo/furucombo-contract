pragma solidity ^0.6.0;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "../HandlerBase.sol";

contract HFunds is HandlerBase {
    using SafeERC20 for IERC20;

    function getContractName() public pure override returns (string memory) {
        return "HFunds";
    }

    function inject(address[] calldata tokens, uint256[] calldata amounts)
        external
        payable
    {
        if (tokens.length != amounts.length)
            _revertMsg("inject", "token and amount does not match");
        address sender = _getSender();
        for (uint256 i = 0; i < tokens.length; i++) {
            IERC20(tokens[i]).safeTransferFrom(
                sender,
                address(this),
                amounts[i]
            );

            // Update involved token
            _updateToken(tokens[i]);
        }
    }

    function sendToken(
        address token,
        uint256 amount,
        address receiver
    ) external payable {
        IERC20(token).safeTransfer(receiver, amount);
    }

    function send(uint256 amount, address payable receiver) external payable {
        receiver.transfer(amount);
    }

    function checkSlippage(
        address[] calldata tokens,
        uint256[] calldata amounts
    ) external payable {
        if (tokens.length != amounts.length) {
            _revertMsg("checkSlippage", "token and amount does not match");
        }

        // FIXME: the detailed error message, ex. which token slippage over the limitation
        // 討論一下有必要為了 error msg 就多寫一個 contact function 和 address to string function 增加風險嗎？

        for (uint256 i = 0; i < tokens.length; i++) {
            if (tokens[i] == address(0)) {
                if (address(this).balance < amounts[i]) {
                    _revertMsg("checkSlippage", "ETH slippage");
                }
                continue;
            }
            if (IERC20(tokens[i]).balanceOf(address(this)) < amounts[i]) {
                _revertMsg("checkSlippage", "token slippage");
            }
        }
    }

    function getBalance(address token) external payable returns (uint256) {
        if (token != address(0)) {
            return IERC20(token).balanceOf(address(this));
        }
        return address(this).balance;
    }
}
