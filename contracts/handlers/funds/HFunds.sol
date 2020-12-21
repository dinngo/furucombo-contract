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
            _revertMsg("checkSlippage", "token and amount do not match");
        }

        for (uint256 i = 0; i < tokens.length; i++) {
            if (tokens[i] == address(0)) {
                if (address(this).balance < amounts[i]) {
                    string memory errMsg =
                        string(
                            abi.encodePacked(
                                "error:",
                                _uint2String(i),
                                "_",
                                _uint2String(address(this).balance)
                            )
                        );
                    _revertMsg("checkSlippage", errMsg);
                }
            } else if (
                IERC20(tokens[i]).balanceOf(address(this)) < amounts[i]
            ) {
                string memory errMsg =
                    string(
                        abi.encodePacked(
                            "error:",
                            _uint2String(i),
                            "_",
                            _uint2String(
                                IERC20(tokens[i]).balanceOf(address(this))
                            )
                        )
                    );

                _revertMsg("checkSlippage", errMsg);
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
