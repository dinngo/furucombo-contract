pragma solidity ^0.5.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";


/**
 * @title SimpleToken
 * @dev Very simple ERC20 Token example, where all tokens are pre-assigned to the creator.
 * Note they can later distribute these tokens as they wish using `transfer` and other
 * `StandardToken` functions.
 */
contract SimpleToken is ERC20 {
    using SafeERC20 for ERC20;

    string public constant name = "SimpleToken"; // solium-disable-line uppercase
    string public constant symbol = "SIM"; // solium-disable-line uppercase
    uint8 public constant decimals = 18; // solium-disable-line uppercase

    uint256 public constant INITIAL_SUPPLY = 10000 * (10**uint256(decimals));

    /**
     * @dev Constructor that gives msg.sender all of existing tokens.
     */
    constructor() public {
        _mint(msg.sender, INITIAL_SUPPLY);
    }
}
