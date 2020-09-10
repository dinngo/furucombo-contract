pragma solidity ^0.5.16;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
// import "@openzeppelin/contracts/utils/Pausable.sol";

import "./IStakingRewards.sol";
import "./IStakingRewardsAdapter.sol";
import "./Whitelistable.sol";


contract StakingRewardsAdapter is IStakingRewardsAdapter, ReentrancyGuard, Whitelistable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    /* ========== STATE VARIABLES ========== */

    IStakingRewards public stakingContract;
    IERC20 public rewardsToken;
    IERC20 public stakingToken;
    uint256 public lastUpdateTime;
    uint256 public rewardPerTokenStored;

    mapping(address => uint256) public userRewardPerTokenPaid;
    mapping(address => uint256) public rewards;

    uint256 private _totalSupply;
    mapping(address => uint256) private _balances;

    /* ========== CONSTRUCTOR ========== */

    constructor(
        address _whitelist,
        address _stakingContract
    ) public Whitelistable(_whitelist) {
        stakingContract = IStakingRewards(_stakingContract);
        rewardsToken = stakingContract.rewardsToken();
        stakingToken = stakingContract.stakingToken();
    }

    /* ========== VIEWS ========== */

    function totalSupply() external view returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account) external view returns (uint256) {
        return _balances[account];
    }

    function lastTimeRewardApplicable() public view returns (uint256) {
        return stakingContract.lastTimeRewardApplicable();
    }

    function rewardPerToken() public view returns (uint256) {
        if (_totalSupply == 0) {
            return rewardPerTokenStored;
        }
        return stakingContract.rewardPerToken();
    }

    function earned(address account) public view returns (uint256) {
        return _balances[account].mul(rewardPerToken().sub(userRewardPerTokenPaid[account])).div(1e18).add(rewards[account]);
    }

    function getRewardForDuration() external view returns (uint256) {
        return stakingContract.getRewardForDuration();
    }

    function rewardRate() external view returns (uint256) {
        return stakingContract.rewardRate();
    }

    /* ========== MODIFIERS ========== */

    modifier updateReward(address account) {
        rewardPerTokenStored = rewardPerToken();
        lastUpdateTime = lastTimeRewardApplicable();
        if (account != address(0)) {
            rewards[account] = earned(account);
            userRewardPerTokenPaid[account] = rewardPerTokenStored;
        }
        _;
    }

    /* ========== INTERNAL FUNCTIONS ========== */

    function _stakeInternal(address account, uint256 amount) internal {
        require(amount > 0, "StakingRewardsAdapter: Cannot stake 0");
        _totalSupply = _totalSupply.add(amount);
        _balances[account] = _balances[account].add(amount);
        stakingToken.safeTransferFrom(msg.sender, address(this), amount);
        stakingToken.safeApprove(address(stakingContract), amount);
        stakingContract.stake(amount);
        // emit Staked(account, amount);
    }

    function _withdrawInternal(address account, uint256 amount) internal {
        require(amount > 0, "StakingRewardsAdapter: Cannot withdraw 0");
        _totalSupply = _totalSupply.sub(amount);
        _balances[account] = _balances[account].sub(amount);
        stakingContract.withdraw(amount);
        stakingToken.safeTransfer(msg.sender, amount);
        // emit Withdrawn(account, amount);
    }

    function _getRewardInternal(address account) internal {
        uint256 reward = rewards[account];
        if (reward > 0) {
            rewards[account] = 0;
            uint256 rewardBalance = rewardsToken.balanceOf(address(this));
            if(reward > rewardBalance) {
                stakingContract.getReward();
            }
            rewardsToken.safeTransfer(msg.sender, reward);
            // emit RewardPaid(account, reward);
        }
    }

    /* ========== SELF_OPERATE FUNCTIONS ========== */

    function stake(uint256 amount) external nonReentrant updateReward(msg.sender) {
        _stakeInternal(msg.sender, amount);
    }

    function withdraw(uint256 amount) public nonReentrant updateReward(msg.sender) {
        _withdrawInternal(msg.sender, amount);
    }

    function getReward() public nonReentrant updateReward(msg.sender) {
        _getRewardInternal(msg.sender);
    }

    function exit() external {
        withdraw(_balances[msg.sender]);
        getReward();
    }

    /* ========== RESTRICTED OPERATE_FOR FUNCTIONS ========== */

    function stakeFor(address account, uint256 amount) external nonReentrant updateReward(account) {
        _stakeInternal(account, amount);
    }

    function withdrawFor(address account, uint256 amount) public nonReentrant onlyWhitelist updateReward(account) {
        _withdrawInternal(account, amount);
    }

    function getRewardFor(address account) public nonReentrant onlyWhitelist updateReward(account) {
        _getRewardInternal(account);
    }

    function exitFor(address account) external onlyWhitelist {
        withdrawFor(account, _balances[account]);
        getRewardFor(account);
    }

    /* ========== EVENTS ========== */

    // event RewardAdded(uint256 reward);
    // event Staked(address indexed user, uint256 amount);
    // event Withdrawn(address indexed user, uint256 amount);
    // event RewardPaid(address indexed user, uint256 reward);
    // event RewardsDurationUpdated(uint256 newDuration);
    // event Recovered(address token, uint256 amount);
}