pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "../HandlerBase.sol";
import "./IStaking.sol";
import "./IMerkleRedeem.sol";

contract HFurucombo is HandlerBase {
    using SafeERC20 for IERC20;

    function stakeFor(
        address pool,
        address onBehalfOf,
        uint256 amount
    ) external payable {
        require(amount > 0, "HFurucombo: stake amount = 0");
        IStaking staking = IStaking(pool);
        address stakeToken = staking.stakingToken();

        IERC20(stakeToken).safeApprove(pool, amount);
        staking.stakeFor(onBehalfOf, amount);
        IERC20(stakeToken).safeApprove(pool, 0);
    }

    function unstakeFor(
        address pool,
        address onBehalfOf,
        uint256 amount
    ) external payable {
        require(amount > 0, "HFurucombo: unstake amount = 0");
        IStaking staking = IStaking(pool);
        staking.unstakeFor(onBehalfOf, amount);

        // Update involved token
        _updateToken(staking.stakingToken());
    }

    function claimAll(
        address user,
        address[] calldata pools,
        IMerkleRedeem.Claim[][] calldata claims
    ) external payable {
        // TODO: return claim amount?
        require(claims.length > 0, "HFurucombo: claims length = 0");
        require(
            pools.length == claims.length,
            "HFurucombo: pools length != claims length"
        );

        for (uint256 i = 0; i < claims.length; i++) {
            IMerkleRedeem redeem = IMerkleRedeem(pools[i]);
            redeem.claimWeeks(user, claims[i]);
        }
    }
}
