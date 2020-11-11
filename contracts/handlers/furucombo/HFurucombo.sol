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
        require(
            amount > 0,
            "HFurucombo: stake amount is less than or equal zero"
        );
        IStaking staking = IStaking(pool);
        address stakeToken = staking.stakingToken();

        // Approve stake amount to stake contract
        IERC20(stakeToken).safeApprove(pool, amount);

        // call stakeFor
        staking.stakeFor(onBehalfOf, amount);

        // Approve 0 to stake contract
        IERC20(stakeToken).safeApprove(pool, 0);
    }

    function unstakeFor(
        address pool,
        address onBehalfOf,
        uint256 amount
    ) external payable {
        require(
            amount > 0,
            "HFurucombo: unstake amount is less than or equal zero"
        );
        IStaking staking = IStaking(pool);

        // call stakeFor
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
        require(pools.length > 0, "HFrurucombo: stake length is equal to zero");
        require(
            pools.length == claims.length,
            "HFurucombo: pools length is not equal to claims length"
        );

        for (uint256 i = 0; i < claims.length; i++) {
            IStaking staking = IStaking(pools[i]);
            staking.claimWeeks(user, claims[i]);
            address redeemToken = staking.redeemable();
            _updateToken(IMerkleRedeem(redeemToken).token());
        }
    }
}
