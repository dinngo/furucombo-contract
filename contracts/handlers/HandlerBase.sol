pragma solidity ^0.5.0;


contract HandlerBase {
  address[] public tokens;

  function _updateToken(address token) internal {
    tokens.push(token);
  }
}
