pragma solidity ^0.5.0;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "../HandlerBase.sol";
import "../../staking/IStakingRewardsAdapter.sol";
import "../../staking/IStakingRewardsAdapterRegistry.sol";

contract HStakingRewardsAdapter is HandlerBase {
    using SafeERC20 for IERC20;

    // prettier-ignore
    IStakingRewardsAdapterRegistry constant public registry = IStakingRewardsAdapterRegistry(0xFad99cE8CA1ff29cb6fEe3Fc8c86975228b3f8cF);

    modifier whenAdapterIsValid(address adapter) {
        require(registry.isValid(adapter), "Invalid adapter");
        _;
    }

    // Stake for msg.sender
    function stake(address adapterAddr, uint256 amount)
        external
        payable
        whenAdapterIsValid(adapterAddr)
    {
        IStakingRewardsAdapter adapter = IStakingRewardsAdapter(adapterAddr);
        IERC20 token = adapter.stakingToken();

        token.safeApprove(address(adapter), amount);
        adapter.stakeFor(cache.getSender(), amount);
        token.safeApprove(address(adapter), 0);
    }

    // Stake for account
    function stakeFor(
        address adapterAddr,
        address account,
        uint256 amount
    ) external payable whenAdapterIsValid(adapterAddr) {
        IStakingRewardsAdapter adapter = IStakingRewardsAdapter(adapterAddr);
        IERC20 token = adapter.stakingToken();

        token.safeApprove(address(adapter), amount);
        adapter.stakeFor(account, amount);
        token.safeApprove(address(adapter), 0);
    }

    // Only withdraw for msg.sender
    function withdraw(address adapterAddr, uint256 amount)
        external
        payable
        whenAdapterIsValid(adapterAddr)
    {
        IStakingRewardsAdapter adapter = IStakingRewardsAdapter(adapterAddr);
        adapter.withdrawFor(cache.getSender(), amount);

        _updateToken(address(adapter.stakingToken()));
    }

    // Only exit for msg.sender
    function exit(address adapterAddr)
        external
        payable
        whenAdapterIsValid(adapterAddr)
    {
        IStakingRewardsAdapter adapter = IStakingRewardsAdapter(adapterAddr);
        adapter.exitFor(cache.getSender());

        _updateToken(address(adapter.stakingToken()));
        _updateToken(address(adapter.rewardsToken()));
    }

    // Only getReward for msg.sender
    function getReward(address adapterAddr)
        external
        payable
        whenAdapterIsValid(adapterAddr)
    {
        IStakingRewardsAdapter adapter = IStakingRewardsAdapter(adapterAddr);
        adapter.getRewardFor(cache.getSender());

        _updateToken(address(adapter.rewardsToken()));
    }
}
