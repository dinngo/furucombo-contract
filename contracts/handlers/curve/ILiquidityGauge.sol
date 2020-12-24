pragma solidity ^0.6.0;

interface ILiquidityGauge {
    function lp_token() external view returns (address);
    function balanceOf(address arg0) external view returns (uint256);

    function set_approve_deposit(address addr, bool can_deposit) external;
    function deposit(uint256 _value, address addr) external;
    function withdraw(uint256 _value) external;
    function claimable_tokens(address addr) external returns (uint256);
}
