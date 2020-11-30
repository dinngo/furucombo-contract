pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import "./IMerkleRedeem.sol";

interface IStaking {
    function stakingToken() external view returns (address);
    function redeemable() external view returns (address);
    function stakeFor(address, uint256) external;
    function unstakeFor(address, uint256) external;
    function claimWeeks(address, IMerkleRedeem.Claim[] calldata) external;
}
