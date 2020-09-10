pragma solidity ^0.5.0;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "../HandlerBase.sol";
import "./IWETH9.sol";

contract HWeth is HandlerBase {
    // prettier-ignore
    address payable public constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;

    function deposit(uint256 value) external payable {
        IWETH9(WETH).deposit.value(value)();
        _updateToken(WETH);
    }

    function withdraw(uint256 wad) external payable {
        IWETH9(WETH).withdraw(wad);
    }
}
