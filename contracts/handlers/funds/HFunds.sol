// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "../HandlerBase.sol";

contract HFunds is HandlerBase {
    using SafeERC20 for IERC20;

    // prettier-ignore
    address public constant ETH_ADDRESS = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    function getContractName() public pure override returns (string memory) {
        return "HFunds";
    }

    function updateTokens(address[] calldata tokens)
        external
        payable
        returns (uint256[] memory)
    {
        uint256[] memory balances = new uint256[](tokens.length);
        for (uint256 i = 0; i < tokens.length; i++) {
            address token = tokens[i];
            if (token != address(0) && token != ETH_ADDRESS) {
                // Update involved token
                _updateToken(token);
            }
            balances[i] = _getBalance(token, type(uint256).max);
        }
        return balances;
    }

    function inject(address[] calldata tokens, uint256[] calldata amounts)
        external
        payable
        returns (uint256[] memory)
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
        return amounts;
    }

    function sendTokens(
        address[] calldata tokens,
        uint256[] calldata amounts,
        address payable receiver
    ) external payable {
        for (uint256 i = 0; i < tokens.length; i++) {
            uint256 amount = _getBalance(tokens[i], amounts[i]);
            if (amount > 0) {
                // ETH case
                if (tokens[i] == address(0) || tokens[i] == ETH_ADDRESS) {
                    receiver.transfer(amount);
                } else {
                    IERC20(tokens[i]).safeTransfer(receiver, amount);
                }
            }
        }
    }

    function send(uint256 amount, address payable receiver) external payable {
        amount = _getBalance(address(0), amount);
        if (amount > 0) {
            receiver.transfer(amount);
        }
    }

    function sendToken(
        address token,
        uint256 amount,
        address receiver
    ) external payable {
        amount = _getBalance(token, amount);
        if (amount > 0) {
            IERC20(token).safeTransfer(receiver, amount);
        }
    }

    /// @notice Send ether to block miner.
    /// @dev Transfer with built-in 2300 gas cap is safer and acceptable for most miners.
    /// @param amount The ether amount.
    function sendEtherToMiner(uint256 amount) external payable {
        if (amount > 0) {
            block.coinbase.transfer(amount);
        }
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
                                "error: ",
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
                            "error: ",
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
        return _getBalance(token, type(uint256).max);
    }
}
