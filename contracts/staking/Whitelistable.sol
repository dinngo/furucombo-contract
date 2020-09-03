pragma solidity ^0.5.0;

import "@openzeppelin/contracts/ownership/Ownable.sol";

contract Whitelistable is Ownable {
    address public _whitelist;

    event WhitelistTransferred(address indexed previousWhitelist, address indexed newWhitelist);

    constructor (address whitelist) internal {
        _whitelist = whitelist;
        emit WhitelistTransferred(address(0), whitelist);
    }

    modifier onlyWhitelist() {
        require(isWhitelist(), "Whitelistable: caller is not whitelisted");
        _;
    }

    function isWhitelist() public view returns (bool) {
        return _msgSender() == _whitelist;
    }

    // function renounceWhitelist() public onlyOwner {
    //     emit WhitelistTransferred(_whitelist, address(0));
    //     _whitelist = address(0);
    // }

    function transferWhitelist(address newWhitelist) public onlyOwner {
        _transferWhitelist(newWhitelist);
    }

    function _transferWhitelist(address newWhitelist) internal {
        // require(newWhitelist != address(0), "Whitelistable: new whitelist is the zero address");
        emit WhitelistTransferred(_whitelist, newWhitelist);
        _whitelist = newWhitelist;
    }
}