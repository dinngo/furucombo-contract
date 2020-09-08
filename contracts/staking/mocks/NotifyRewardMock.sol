pragma solidity ^0.5.16;

import "../IStakingRewards.sol";

contract NotifyRewardMock {
    function notifyReward(uint256 reward, address stakingContract, address adapter) external {
        // Nofity reward on original staking contract
        IStakingRewards(stakingContract).notifyRewardAmount(reward);
        // Also update adapter's state to make tests easier
        IStakingRewards(adapter).getReward();
    }
}