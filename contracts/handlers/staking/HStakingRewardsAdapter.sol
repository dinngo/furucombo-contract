pragma solidity ^0.6.0;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "../HandlerBase.sol";
import "../../staking/IStakingRewardsAdapter.sol";
import "../../staking/IStakingRewardsAdapterRegistry.sol";

contract HStakingRewardsAdapter is HandlerBase {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    // prettier-ignore
    IStakingRewardsAdapterRegistry constant public registry = IStakingRewardsAdapterRegistry(0xCa591346A311A372a20ed69e08bBE5107979e243);

    modifier whenAdapterIsValid(address adapter) {
        if (!registry.isValid(adapter)) {
            _revertMsg("General", "Invalid adapter");
        }
        _;
    }

    function getContractName() public pure override returns (string memory) {
        return "HStakingRewardsAdapter";
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

        try adapter.stakeFor(_getSender(), amount) {} catch Error(
            string memory reason
        ) {
            _revertMsg("stake", reason);
        } catch {
            _revertMsg("stake");
        }

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

        try adapter.stakeFor(account, amount) {} catch Error(
            string memory reason
        ) {
            _revertMsg("stakeFor", reason);
        } catch {
            _revertMsg("stakeFor");
        }

        token.safeApprove(address(adapter), 0);
    }

    // Only withdraw for msg.sender
    function withdraw(address adapterAddr, uint256 amount)
        external
        payable
        whenAdapterIsValid(adapterAddr)
    {
        IStakingRewardsAdapter adapter = IStakingRewardsAdapter(adapterAddr);

        try adapter.withdrawFor(_getSender(), amount) {} catch Error(
            string memory reason
        ) {
            _revertMsg("withdraw", reason);
        } catch {
            _revertMsg("withdraw");
        }

        _updateToken(address(adapter.stakingToken()));
    }

    // Only exit for msg.sender
    function exit(address adapterAddr)
        external
        payable
        whenAdapterIsValid(adapterAddr)
        returns (uint256 withdrawAmount, uint256 rewardsAmount)
    {
        IStakingRewardsAdapter adapter = IStakingRewardsAdapter(adapterAddr);
        IERC20 stakingToken = adapter.stakingToken();
        IERC20 rewardsToken = adapter.rewardsToken();
        uint256 stakingTokenBalance = stakingToken.balanceOf(address(this));
        uint256 rewardsTokenBalance = rewardsToken.balanceOf(address(this));

        try adapter.exitFor(_getSender()) {} catch Error(string memory reason) {
            _revertMsg("exit", reason);
        } catch {
            _revertMsg("exit");
        }

        _updateToken(address(stakingToken));
        _updateToken(address(rewardsToken));

        // Calculate return amounts
        withdrawAmount = stakingToken.balanceOf(address(this)).sub(
            stakingTokenBalance
        );
        rewardsAmount = rewardsToken.balanceOf(address(this)).sub(
            rewardsTokenBalance
        );
    }

    // Only getReward for msg.sender
    function getReward(address adapterAddr)
        external
        payable
        whenAdapterIsValid(adapterAddr)
        returns (uint256 rewardsAmount)
    {
        IStakingRewardsAdapter adapter = IStakingRewardsAdapter(adapterAddr);
        IERC20 rewardsToken = adapter.rewardsToken();
        uint256 rewardsTokenBalance = rewardsToken.balanceOf(address(this));

        try adapter.getRewardFor(_getSender()) {} catch Error(
            string memory reason
        ) {
            _revertMsg("getReward", reason);
        } catch {
            _revertMsg("getReward");
        }

        _updateToken(address(rewardsToken));

        // Calculate return amount
        rewardsAmount = rewardsToken.balanceOf(address(this)).sub(
            rewardsTokenBalance
        );
    }
}
