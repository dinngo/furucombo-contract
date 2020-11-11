pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/ownership/Ownable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/lifecycle/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./SimpleMerkleRedeem.sol";

contract Staking is Ownable, Pausable, ReentrancyGuard {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    IERC20 public stakingToken;
    MerkleRedeem public redeemable;

    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => bool)) private _approvals;

    event Staked(
        address indexed sender,
        address indexed onBehalfOf,
        uint256 amount
    );
    event Unstaked(
        address indexed sender,
        address indexed onBehalfOf,
        uint256 amount
    );
    event Approved(address indexed user, address indexed agent, bool approval);

    modifier onlyApproved(address owner) {
        require(_approvals[owner][msg.sender], "Agent is not approved");
        _;
    }

    constructor(address _stakingToken, address _rewardToken) public {
        stakingToken = IERC20(_stakingToken);
        redeemable = new MerkleRedeem(_rewardToken);
        redeemable.transferOwnership(msg.sender);
    }

    function isApproved(address user, address agent)
        external
        view
        returns (bool)
    {
        return _approvals[user][agent];
    }

    function balanceOf(address user) external view returns (uint256) {
        return _balances[user];
    }

    function setApproval(address agent, bool approval) external {
        require(agent != address(0));
        require(_approvals[msg.sender][agent] != approval);
        _approvals[msg.sender][agent] = approval;
        emit Approved(msg.sender, agent, approval);
    }

    function stake(uint256 amount) external nonReentrant whenNotPaused {
        _stakeInternal(msg.sender, amount);
    }

    function stakeFor(address onBehalfOf, uint256 amount)
        external
        nonReentrant
        whenNotPaused
    {
        _stakeInternal(onBehalfOf, amount);
    }

    function unstake(uint256 amount) external nonReentrant {
        _unstakeInternal(msg.sender, amount);
    }

    function unstakeFor(address onBehalfOf, uint256 amount)
        external
        nonReentrant
        onlyApproved(onBehalfOf)
    {
        _unstakeInternal(onBehalfOf, amount);
    }

    function claimWeek(
        address user,
        uint256 week,
        uint256 balance,
        bytes32[] memory merkleProof
    ) public {
        redeemable.claimWeek(user, week, balance, merkleProof);
    }

    function claimWeeks(address user, MerkleRedeem.Claim[] memory claims)
        public
    {
        redeemable.claimWeeks(user, claims);
    }

    function _stakeInternal(address user, uint256 amount) internal {
        require(amount > 0);
        _balances[user] = _balances[user].add(amount);
        stakingToken.safeTransferFrom(msg.sender, address(this), amount);
        emit Staked(msg.sender, user, amount);
    }

    function _unstakeInternal(address user, uint256 amount) internal {
        require(amount > 0);
        _balances[user] = _balances[user].sub(amount);
        stakingToken.safeTransfer(msg.sender, amount);
        emit Unstaked(msg.sender, user, amount);
    }
}
