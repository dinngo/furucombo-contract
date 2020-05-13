pragma solidity ^0.5.0;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "../HandlerBase.sol";


contract HERC20TokenIn is HandlerBase {
    using SafeERC20 for IERC20;

    function inject(address[] calldata tokens, uint256[] calldata amounts)
        external
        payable
    {
        require(
            tokens.length == amounts.length,
            "token and amount does not match"
        );
        for (uint256 i = 0; i < tokens.length; i++) {
            IERC20(tokens[i]).safeTransferFrom(
                msg.sender,
                address(this),
                amounts[i]
            );

            // Update post process
            _updateToken(tokens[i]);
        }
    }
}
