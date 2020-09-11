pragma solidity ^0.5.0;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

contract OldHandlerBase {
    address[] public tokens;

    function _updateToken(address token) internal {
        tokens.push(token);
    }
}

contract OldHERC20TokenIn is OldHandlerBase {
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

            // Update involved token
            _updateToken(tokens[i]);
        }
    }
}
