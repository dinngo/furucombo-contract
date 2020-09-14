const {
  balance,
  BN,
  constants,
  ether,
  expectEvent,
  expectRevert,
  time,
} = require('@openzeppelin/test-helpers');
const { tracker } = balance;
const { duration, increase, latest } = time;
const abi = require('ethereumjs-abi');
const utils = web3.utils;

const { expect } = require('chai');

const {
  DAI_TOKEN,
  DAI_PROVIDER,
  KNC_TOKEN,
  KNC_PROVIDER,
} = require('./utils/constants');
const { evmRevert, evmSnapshot } = require('./utils/utils');

const StakingRewards = artifacts.require('StakingRewards');
const StakingRewardsAdapter = artifacts.require('StakingRewardsAdapter');
const NotifyRewardMock = artifacts.require('NotifyRewardMock');
const IToken = artifacts.require('IERC20');

contract('StakingRewardsAdapter - Action For', function([
  _,
  whitelist,
  notWhitelist,
  user0,
  user1,
  user2,
  pauser
]) {
  let id;
  /// whitelist is the address who gets the permission to do actions for the user
  /// user0 stake to the original staking contract
  /// user1 stake to the adapter contract
  /// user2 case by case
  /// pauser who can set adapter to paused
  /// st = stakingToken
  /// rt = rewardToken
  const stAddress = DAI_TOKEN;
  const stProviderAddress = DAI_PROVIDER;
  const rtAddress = KNC_TOKEN;
  const rtProviderAddress = KNC_PROVIDER;

  before(async function() {
    this.st = await IToken.at(stAddress);
    this.rt = await IToken.at(rtAddress);
    this.notifyReward = await NotifyRewardMock.new();
    this.staking = await StakingRewards.new(
      _,
      this.notifyReward.address,
      rtAddress,
      stAddress
    );
    this.adapter = await StakingRewardsAdapter.new(this.staking.address);
  });

  beforeEach(async function() {
    id = await evmSnapshot();
  });

  afterEach(async function() {
    await evmRevert(id);
  });

  describe('Authorized', function() {
    beforeEach(async function() {
      rewardUser0Amount = await this.rt.balanceOf.call(user0);
      rewardUser1Amount = await this.rt.balanceOf.call(user1);
      rewardUser2Amount = await this.rt.balanceOf.call(user2);
    });

    it('1 on original - 1 on adapter stake by whitelist', async function() {
      // Prepare staking data
      const sValue = ether('100');
      const rValue = ether('6048');
      await this.st.transfer(user0, sValue, { from: stProviderAddress });
      await this.st.transfer(whitelist, sValue, { from: stProviderAddress });

      // User0 stake to original
      await this.st.approve(this.staking.address, sValue, { from: user0 });
      await this.staking.stake(sValue, { from: user0 });
      // Whitelist stake to adapter for user1
      await this.adapter.setApproval(whitelist, true, { from: user1 });
      await this.st.approve(this.adapter.address, sValue, { from: whitelist });
      await this.adapter.stakeFor(user1, sValue, { from: whitelist });

      // Notify reward
      await this.rt.transfer(this.staking.address, rValue, {
        from: rtProviderAddress,
      });
      await this.notifyReward.notifyReward(
        rValue,
        this.staking.address,
        this.adapter.address,
        { from: rtProviderAddress }
      );

      // Make time elapsed
      await increase(duration.days(1));

      const earnedAdapter = await this.staking.earned.call(
        this.adapter.address
      );
      const earnedUser0 = await this.staking.earned.call(user0);
      const earnedUser1 = await this.adapter.earned.call(user1);
      const earnedWhitelist = await this.adapter.earned.call(whitelist);

      log('earnedAdapter', earnedAdapter);
      log('earnedUser0', earnedUser0);
      log('earnedUser1', earnedUser1);
      await printStateAdapter(this.adapter.address, user1);
      await printStateOriginal(this.staking.address, user0);

      // Verify everyone gets reward
      expect(earnedUser0).to.be.bignumber.gt(ether('0'));
      expect(earnedUser1).to.be.bignumber.gt(ether('0'));
      expect(earnedAdapter).to.be.bignumber.gt(ether('0'));
      // Verify whitelist not unexpectedlly earn any reward
      expect(earnedWhitelist).to.be.zero;

      // Verify user0 & user1 gets equal share
      expect(earnedUser0).to.be.bignumber.eq(earnedUser1);
      // Verify user1 gets whole share of adapter
      expect(earnedUser1).to.be.bignumber.eq(earnedAdapter);

      // Actually invoke getReward and verify amount
      await this.adapter.getReward({ from: user1 });
      const rewardUser1AmountAfter = await this.rt.balanceOf(user1);
      const rewardUser1Got = rewardUser1AmountAfter.sub(rewardUser1Amount);
      // Verify 'earned <= rewardActuallyGot <= earned * 1.001' caused by timestamp differ
      expect(rewardUser1Got).to.be.bignumber.gte(earnedUser1);
      expect(rewardUser1Got).to.be.bignumber.lte(getBuffer(earnedUser1));
      log('rewardUser1Got', rewardUser1Got);
    });

    it('1 on original - 2 on adapter - one stake by whitelist', async function() {
      // Prepare staking data
      const sValue = ether('100');
      const rValue = ether('6048');
      await this.st.transfer(user0, sValue, { from: stProviderAddress });
      await this.st.transfer(user1, sValue, { from: stProviderAddress });
      await this.st.transfer(whitelist, sValue, { from: stProviderAddress });

      // Staking to original and adapter contract respectively
      await this.st.approve(this.staking.address, sValue, { from: user0 });
      await this.staking.stake(sValue, { from: user0 });
      await this.st.approve(this.adapter.address, sValue, { from: user1 });
      await this.adapter.stake(sValue, { from: user1 });
      // Whitelist stake to adapter for user2
      await this.adapter.setApproval(whitelist, true, { from: user2 });
      await this.st.approve(this.adapter.address, sValue, { from: whitelist });
      await this.adapter.stakeFor(user2, sValue, { from: whitelist });

      // Notify reward
      await this.rt.transfer(this.staking.address, rValue, {
        from: rtProviderAddress,
      });
      await this.notifyReward.notifyReward(
        rValue,
        this.staking.address,
        this.adapter.address,
        { from: rtProviderAddress }
      );

      // Make time elapsed
      await increase(duration.days(1));

      const earnedAdapter = await this.staking.earned.call(
        this.adapter.address
      );
      const earnedUser0 = await this.staking.earned.call(user0);
      const earnedUser1 = await this.adapter.earned.call(user1);
      const earnedUser2 = await this.adapter.earned.call(user2);
      const earnedWhitelist = await this.adapter.earned.call(whitelist);

      log('earnedAdapter', earnedAdapter);
      log('earnedUser0', earnedUser0);
      log('earnedUser1', earnedUser1);
      await printStateAdapter(this.adapter.address, user1);
      await printStateOriginal(this.staking.address, user0);

      // Verify everyone gets reward
      expect(earnedUser0).to.be.bignumber.gt(ether('0'));
      expect(earnedUser1).to.be.bignumber.gt(ether('0'));
      expect(earnedUser2).to.be.bignumber.gt(ether('0'));
      expect(earnedAdapter).to.be.bignumber.gt(ether('0'));
      // Verify whitelist not unexpectedlly earn any reward
      expect(earnedWhitelist).to.be.zero;

      // Verify everyone gets equal share
      expect(earnedUser0).to.be.bignumber.eq(earnedUser1);
      expect(earnedUser1).to.be.bignumber.eq(earnedUser2);
      // Verify user1 + user2 get whole share of adapter
      expect(earnedAdapter).to.be.bignumber.eq(earnedUser1.add(earnedUser2));

      // Actually invoke getReward and verify amount
      await this.adapter.getReward({ from: user2 });
      const rewardUser2AmountAfter = await this.rt.balanceOf(user2);
      const rewardUser2Got = rewardUser2AmountAfter.sub(rewardUser2Amount);
      await this.adapter.getReward({ from: user1 });
      const rewardUser1AmountAfter = await this.rt.balanceOf(user1);
      const rewardUser1Got = rewardUser1AmountAfter.sub(rewardUser1Amount);
      // Verify 'earned <= rewardActuallyGot <= earned * 1.001' caused by timestamp differ
      expect(rewardUser2Got).to.be.bignumber.gte(earnedUser2);
      expect(rewardUser2Got).to.be.bignumber.lte(getBuffer(earnedUser2));
      log('rewardUser2Got', rewardUser2Got);
      // Verify 'earned <= rewardActuallyGot <= earned * 1.001' caused by timestamp differ
      expect(rewardUser1Got).to.be.bignumber.gte(earnedUser1);
      expect(rewardUser1Got).to.be.bignumber.lte(getBuffer(earnedUser1));
      log('rewardUser1Got', rewardUser1Got);
    });

    it('1 on original - 2 on adapter - one stake in the middle by whitelist', async function() {
      // Prepare staking data
      const sValue = ether('100');
      const rValue = ether('6048');
      await this.st.transfer(user0, sValue, { from: stProviderAddress });
      await this.st.transfer(user1, sValue, { from: stProviderAddress });
      await this.st.transfer(whitelist, sValue, { from: stProviderAddress });

      // Staking to original and adapter contract respectively
      await this.st.approve(this.staking.address, sValue, { from: user0 });
      await this.staking.stake(sValue, { from: user0 });
      await this.st.approve(this.adapter.address, sValue, { from: user1 });
      await this.adapter.stake(sValue, { from: user1 });

      // Notify reward
      await this.rt.transfer(this.staking.address, rValue, {
        from: rtProviderAddress,
      });
      await this.notifyReward.notifyReward(
        rValue,
        this.staking.address,
        this.adapter.address,
        { from: rtProviderAddress }
      );

      // Make time elapsed
      await increase(duration.days(1));

      // Whitelist stake for user2 through adapter
      await this.adapter.setApproval(whitelist, true, { from: user2 });
      await this.st.approve(this.adapter.address, sValue, { from: whitelist });
      await this.adapter.stakeFor(user2, sValue, { from: whitelist });

      // Make time elapsed
      await increase(duration.days(1));

      // Get the state after user2 staked
      const earnedAdapter = await this.staking.earned.call(
        this.adapter.address
      );
      log('earnedAdapter', earnedAdapter);
      const earnedUser0 = await this.staking.earned.call(user0);
      log('earnedUser0', earnedUser0);
      const earnedUser1 = await this.adapter.earned.call(user1);
      log('earnedUser1', earnedUser1);
      const earnedUser2 = await this.adapter.earned.call(user2);
      log('earnedUser2', earnedUser2);
      const earnedWhitelist = await this.adapter.earned.call(whitelist);
      log('earnedWhitelist', earnedWhitelist);

      // Verify everyone gets reward
      expect(earnedUser0).to.be.bignumber.gt(ether('0'));
      expect(earnedUser1).to.be.bignumber.gt(ether('0'));
      expect(earnedUser2).to.be.bignumber.gt(ether('0'));
      expect(earnedAdapter).to.be.bignumber.gt(ether('0'));
      // Verify whitelist not unexpectedlly earn any reward
      expect(earnedWhitelist).to.be.zero;

      // Verify user0 & user1 gets equal share
      expect(earnedUser0).to.be.bignumber.eq(earnedUser1);
      // Verify earnedAdapter = user1 + user2
      expect(earnedAdapter).to.be.bignumber.eq(earnedUser1.add(earnedUser2));
    });

    it('1 on original - 2 on adapter - one exit in the middle by whitelist', async function() {
      // Prepare staking data
      const sValue = ether('100');
      const rValue = ether('6048');
      await this.st.transfer(user0, sValue, { from: stProviderAddress });
      await this.st.transfer(user1, sValue, { from: stProviderAddress });
      await this.st.transfer(user2, sValue, { from: stProviderAddress });

      // Staking to original and adapter contract respectively
      await this.st.approve(this.staking.address, sValue, { from: user0 });
      await this.staking.stake(sValue, { from: user0 });
      await this.st.approve(this.adapter.address, sValue, { from: user1 });
      await this.adapter.stake(sValue, { from: user1 });
      // Stake by user2 self and whitelist will exitFor user2 later
      await this.st.approve(this.adapter.address, sValue, { from: user2 });
      await this.adapter.stake(sValue, { from: user2 });

      // Notify reward
      await this.rt.transfer(this.staking.address, rValue, {
        from: rtProviderAddress,
      });
      await this.notifyReward.notifyReward(
        rValue,
        this.staking.address,
        this.adapter.address,
        { from: rtProviderAddress }
      );

      // Make time elapsed
      await increase(duration.days(1));

      // Whitelist exitFor user2
      const earnedUser2 = await this.adapter.earned.call(user2);
      await this.adapter.setApproval(whitelist, true, { from: user2 });
      await this.adapter.exitFor(user2, { from: whitelist });
      const rewardUser2AmountAfter = await this.rt.balanceOf(user2);
      const rewardUser2Got = rewardUser2AmountAfter.sub(rewardUser2Amount);
      const rewardWhitelist = await this.rt.balanceOf(whitelist);

      // Make time elapsed
      await increase(duration.days(1));

      // Get the state after user2 claimed and exited
      const rewardAdapter = await this.rt.balanceOf(this.adapter.address);
      log('rewardAdapter', rewardAdapter);
      const earnedAdapter = await this.staking.earned.call(
        this.adapter.address
      );
      log('earnedAdapter', earnedAdapter);
      // Total reward adapter got = earned(adapter) + rt.balanceOf(adapter) since
      // anyone invokes `getReward()` on adapter will make adapter to claim all its
      // reward from original contract and reset the earned number.
      const totalRewardAdapter = rewardAdapter.add(earnedAdapter);
      const earnedUser0 = await this.staking.earned.call(user0);
      log('earnedUser0', earnedUser0);
      const earnedUser1 = await this.adapter.earned.call(user1);
      log('earnedUser1', earnedUser1);
      const earnedWhitelist = await this.adapter.earned.call(whitelist);

      // Verify everyone being counted for reward
      expect(earnedUser0).to.be.bignumber.gt(ether('0'));
      expect(earnedUser1).to.be.bignumber.gt(ether('0'));
      expect(earnedUser2).to.be.bignumber.gt(ether('0'));
      expect(totalRewardAdapter).to.be.bignumber.gt(ether('0'));
      // Verify whitelist not being counted for reward
      expect(earnedWhitelist).to.be.zero;

      // Verify user0 & user1 gets equal share
      expect(earnedUser0).to.be.bignumber.eq(earnedUser1);
      // Verify user1 gets whole share of adapter after user2 claimed
      expect(earnedUser1).to.be.bignumber.eq(totalRewardAdapter);
      // Verify whitelist gets the reward user2 earned since actionFor will transfer assets to msg.sender
      expect(rewardWhitelist).to.be.bignumber.gte(earnedUser2);
      expect(rewardWhitelist).to.be.bignumber.lte(getBuffer(earnedUser2));
      log('rewardWhitelist', rewardWhitelist);
      // Verify user2 not gets the reward since its been transfered to whitelist
      expect(rewardUser2Got).to.be.zero;
      log('rewardUser2Got', rewardUser2Got);
      // Verify whitelist gets the amount unstake for user2
      expect(await this.st.balanceOf(whitelist)).to.be.bignumber.eq(sValue);
      // Verify user2 not gets the amount unstake since its been transfered to whitelist
      expect(await this.st.balanceOf(user2)).to.be.zero;
      // Verify user2 unstake all share after whitelist exitFor him
      expect(await this.adapter.balanceOf(user2)).to.be.zero;
      // Verify user2 not being rewarded after exit
      expect(await this.adapter.earned(user2)).to.be.zero;

      // Actually invoke getReward and verify amount
      await this.adapter.getReward({ from: user1 });
      const rewardUser1AmountAfter = await this.rt.balanceOf(user1);
      const rewardUser1Got = rewardUser1AmountAfter.sub(rewardUser1Amount);
      // Verify 'earned <= rewardActuallyGot <= earned * 1.001' caused by timestamp differ
      expect(rewardUser1Got).to.be.bignumber.gte(earnedUser1);
      expect(rewardUser1Got).to.be.bignumber.lte(getBuffer(earnedUser1));
      log('rewardUser1Got', rewardUser1Got);
    });

    it('1 on original - 2 on adapter - one getReward in the middle by whitelist', async function() {
      // Prepare staking data
      const sValue = ether('100');
      const rValue = ether('6048');
      await this.st.transfer(user0, sValue, { from: stProviderAddress });
      await this.st.transfer(user1, sValue, { from: stProviderAddress });
      await this.st.transfer(user2, sValue, { from: stProviderAddress });

      // Staking to original and adapter contract respectively
      await this.st.approve(this.staking.address, sValue, { from: user0 });
      await this.staking.stake(sValue, { from: user0 });
      await this.st.approve(this.adapter.address, sValue, { from: user1 });
      await this.adapter.stake(sValue, { from: user1 });
      // Stake by user2 self and whitelist will getRewardFor user2 later
      await this.st.approve(this.adapter.address, sValue, { from: user2 });
      await this.adapter.stake(sValue, { from: user2 });

      // Notify reward
      await this.rt.transfer(this.staking.address, rValue, {
        from: rtProviderAddress,
      });
      await this.notifyReward.notifyReward(
        rValue,
        this.staking.address,
        this.adapter.address,
        { from: rtProviderAddress }
      );

      // Make time elapsed
      await increase(duration.days(1));

      // Whitelist getRewardFor user2 but not unstake
      const earnedUser2Middle = await this.adapter.earned.call(user2);
      await this.adapter.setApproval(whitelist, true, { from: user2 });
      await this.adapter.getRewardFor(user2, { from: whitelist });
      const rewardUser2Middle = await this.rt.balanceOf.call(user2);
      log('rewardUser2Middle', rewardUser2Middle);
      const rewardWhitelist = await this.rt.balanceOf.call(whitelist);
      log('rewardWhitelist', rewardWhitelist);

      // Make time elapsed
      await increase(duration.days(1));

      // Get the state after whitelist getRewardFor user2
      const rewardAdapter = await this.rt.balanceOf(this.adapter.address);
      log('rewardAdapter', rewardAdapter);
      const earnedAdapter = await this.staking.earned.call(
        this.adapter.address
      );
      log('earnedAdapter', earnedAdapter);
      // Total reward adapter got = earned(adapter) + rt.balanceOf(adapter) since
      // anyone invokes `getReward()` on adapter will make adapter to claim all its
      // reward from original contract and reset the earned number.
      const totalRewardAdapter = rewardAdapter.add(earnedAdapter);
      const earnedUser0 = await this.staking.earned.call(user0);
      log('earnedUser0', earnedUser0);
      const earnedUser1 = await this.adapter.earned.call(user1);
      log('earnedUser1', earnedUser1);
      const earnedUser2End = await this.adapter.earned.call(user2);
      log('earnedUser2End', earnedUser2End);
      const earnedWhitelist = await this.adapter.earned.call(whitelist);
      log('earnedWhitelist', earnedWhitelist);

      // Verify everyone being counted for reward
      expect(earnedUser0).to.be.bignumber.gt(ether('0'));
      expect(earnedUser1).to.be.bignumber.gt(ether('0'));
      expect(earnedUser2Middle).to.be.bignumber.gt(ether('0'));
      expect(earnedUser2End).to.be.bignumber.gt(ether('0'));
      expect(totalRewardAdapter).to.be.bignumber.gt(ether('0'));
      // Verify whitelist not being counted for reward
      expect(earnedWhitelist).to.be.zero;

      // Verify user0 & user1 gets equal share
      expect(earnedUser0).to.be.bignumber.eq(earnedUser1);
      // Verify user1 gets equal amount to user2 + whitelist got
      expect(earnedUser1).to.be.bignumber.eq(
        rewardWhitelist.add(earnedUser2End)
      );
      // Verify whitelist's rt balance equals to user2 earnedAmountMiddle after getRewardFor user2
      expect(rewardWhitelist).to.be.bignumber.gte(earnedUser2Middle);
      expect(rewardWhitelist).to.be.bignumber.lte(getBuffer(earnedUser2Middle));
      // Verify user2 not get the reward in the middle since its been transfered to whitelist
      expect(rewardUser2Middle).to.be.zero;
      // Verify adapter earned overall equals to 2x of user0 has earned
      expect(totalRewardAdapter.add(rewardWhitelist)).to.be.bignumber.eq(
        earnedUser0.mul(new BN('2'))
      );
    });

    it('paused -> unpaused -> stakeFor', async function() {
      // Prepare staking data
      const sValue = ether('100');
      await this.st.transfer(whitelist, sValue, { from: stProviderAddress });
      // Add pauser
      await this.adapter.addPauser(pauser, {from: _});
      // Set paused on adapter
      await this.adapter.pause({from: pauser});
      // Whitelist stake to adapter for user1
      await this.adapter.setApproval(whitelist, true, { from: user1 });
      await this.st.approve(this.adapter.address, sValue, { from: whitelist });
      await expectRevert(this.adapter.stakeFor(user1, sValue, { from: whitelist }), 'Pausable: paused');
      // Set unpaused on adapter
      await this.adapter.unpause({from: _});
      // Should success when not paused
      await this.adapter.stakeFor(user1, sValue, { from: whitelist });
      const stakingUser1 = await this.adapter.balanceOf.call(user1);
      expect(stakingUser1).to.be.bignumber.eq(stakingUser1);
    });
  });

  describe('Unauthorized', function() {
    beforeEach(async function() {
      rewardUser0Amount = await this.rt.balanceOf.call(user0);
      rewardUser1Amount = await this.rt.balanceOf.call(user1);
      rewardUser2Amount = await this.rt.balanceOf.call(user2);
    });

    it('should success: stakeFor by notWhitelist', async function() {
      // Prepare staking data
      const sValue = ether('100');
      const rValue = ether('6048');
      await this.st.transfer(user0, sValue, { from: stProviderAddress });
      await this.st.transfer(notWhitelist, sValue, { from: stProviderAddress });

      // User0 stake to original
      await this.st.approve(this.staking.address, sValue, { from: user0 });
      await this.staking.stake(sValue, { from: user0 });
      // NotWhitelist stake to adapter for user1
      await this.st.approve(this.adapter.address, sValue, {
        from: notWhitelist,
      });
      await this.adapter.stakeFor(user1, sValue, { from: notWhitelist });

      // Notify reward
      await this.rt.transfer(this.staking.address, rValue, {
        from: rtProviderAddress,
      });
      await this.notifyReward.notifyReward(
        rValue,
        this.staking.address,
        this.adapter.address,
        { from: rtProviderAddress }
      );

      // Make time elapsed
      await increase(duration.days(1));

      const earnedAdapter = await this.staking.earned.call(
        this.adapter.address
      );
      const earnedUser0 = await this.staking.earned.call(user0);
      const earnedUser1 = await this.adapter.earned.call(user1);
      const earnedNotWhitelist = await this.adapter.earned.call(notWhitelist);

      log('earnedAdapter', earnedAdapter);
      log('earnedUser0', earnedUser0);
      log('earnedUser1', earnedUser1);
      await printStateAdapter(this.adapter.address, user1);
      await printStateOriginal(this.staking.address, user0);

      // Verify everyone gets reward
      expect(earnedUser0).to.be.bignumber.gt(ether('0'));
      expect(earnedUser1).to.be.bignumber.gt(ether('0'));
      expect(earnedAdapter).to.be.bignumber.gt(ether('0'));
      // Verify notWhitelist not unexpectedlly earn any reward
      expect(earnedNotWhitelist).to.be.zero;

      // Verify user0 & user1 gets equal share
      expect(earnedUser0).to.be.bignumber.eq(earnedUser1);
      // Verify user1 gets whole share of adapter
      expect(earnedUser1).to.be.bignumber.eq(earnedAdapter);

      // Actually invoke getReward and verify amount
      await this.adapter.getReward({ from: user1 });
      const rewardUser1AmountAfter = await this.rt.balanceOf(user1);
      const rewardUser1Got = rewardUser1AmountAfter.sub(rewardUser1Amount);
      // Verify 'earned <= rewardActuallyGot <= earned * 1.001' caused by timestamp differ
      expect(rewardUser1Got).to.be.bignumber.gte(earnedUser1);
      expect(rewardUser1Got).to.be.bignumber.lte(getBuffer(earnedUser1));
      log('rewardUser1Got', rewardUser1Got);
    });

    it('should revert: exitFor by notWhitelist', async function() {
      // Prepare staking data
      const sValue = ether('100');
      const rValue = ether('6048');
      await this.st.transfer(user2, sValue, { from: stProviderAddress });

      // Stake by user2 self and notWhitelist will exitFor user2 later
      await this.st.approve(this.adapter.address, sValue, { from: user2 });
      await this.adapter.stake(sValue, { from: user2 });

      // Notify reward
      await this.rt.transfer(this.staking.address, rValue, {
        from: rtProviderAddress,
      });
      await this.notifyReward.notifyReward(
        rValue,
        this.staking.address,
        this.adapter.address,
        { from: rtProviderAddress }
      );

      // Make time elapsed
      await increase(duration.days(1));

      // NotWhitelist exitFor user2
      await expectRevert(
        this.adapter.exitFor(user2, { from: notWhitelist }),
        'StakingRewardsAdapter: agent not been approved'
      );
    });

    it('should revert: withdrawFor by notWhitelist', async function() {
      // Prepare staking data
      const sValue = ether('100');
      const rValue = ether('6048');
      await this.st.transfer(user2, sValue, { from: stProviderAddress });

      // Stake by user2 self and notWhitelist will withdrawFor user2 later
      await this.st.approve(this.adapter.address, sValue, { from: user2 });
      await this.adapter.stake(sValue, { from: user2 });

      // Notify reward
      await this.rt.transfer(this.staking.address, rValue, {
        from: rtProviderAddress,
      });
      await this.notifyReward.notifyReward(
        rValue,
        this.staking.address,
        this.adapter.address,
        { from: rtProviderAddress }
      );

      // Make time elapsed
      await increase(duration.days(1));

      // NotWhitelist exitFor user2
      await expectRevert(
        this.adapter.getRewardFor(user2, { from: notWhitelist }),
        'StakingRewardsAdapter: agent not been approved'
      );
    });

    it('should revert: getRewardFor by notWhitelist', async function() {
      // Prepare staking data
      const sValue = ether('100');
      const rValue = ether('6048');
      await this.st.transfer(user2, sValue, { from: stProviderAddress });

      // Stake by user2 self and notWhitelist will getRewardFor user2 later
      await this.st.approve(this.adapter.address, sValue, { from: user2 });
      await this.adapter.stake(sValue, { from: user2 });

      // Notify reward
      await this.rt.transfer(this.staking.address, rValue, {
        from: rtProviderAddress,
      });
      await this.notifyReward.notifyReward(
        rValue,
        this.staking.address,
        this.adapter.address,
        { from: rtProviderAddress }
      );

      // Make time elapsed
      await increase(duration.days(1));

      // NotWhitelist exitFor user2
      await expectRevert(
        this.adapter.getRewardFor(user2, { from: notWhitelist }),
        'StakingRewardsAdapter: agent not been approved'
      );
    });
  });
});

function getBuffer(num) {
  return new BN(num).mul(new BN(1001)).div(new BN(1000));
}

function log(text, value) {
  console.log(`>>> ${text}: ${value}`);
}

async function printStateAdapter(adapterAddr, user) {
  const adapter = await StakingRewardsAdapter.at(adapterAddr);
  const totalSupply = await adapter.totalSupply.call();
  const balanceOfUser = await adapter.balanceOf.call(user);
  const lastTimeRewardApplicable = await adapter.lastTimeRewardApplicable.call();
  const lastUpdateTime = await adapter.lastUpdateTime.call();
  const rewardPerToken = await adapter.rewardPerToken.call();
  const rewardPerTokenStored = await adapter.rewardPerTokenStored.call();
  const earnedUser = await adapter.earned.call(user);
  log('==== printState', 'Adapter');
  log('totalSupply', totalSupply);
  log('balanceOfUser', balanceOfUser);
  log('lastTimeRewardApplicable', lastTimeRewardApplicable);
  log('lastUpdateTime', lastUpdateTime);
  log('rewardPerToken', rewardPerToken);
  log('rewardPerTokenStored', rewardPerTokenStored);
  log('earnedUser', earnedUser);
}

async function printStateOriginal(contractAddr, user) {
  const contract = await StakingRewardsAdapter.at(contractAddr);
  const totalSupply = await contract.totalSupply.call();
  const balanceOfUser = await contract.balanceOf.call(user);
  const lastTimeRewardApplicable = await contract.lastTimeRewardApplicable.call();
  const lastUpdateTime = await contract.lastUpdateTime.call();
  const rewardPerToken = await contract.rewardPerToken.call();
  const rewardPerTokenStored = await contract.rewardPerTokenStored.call();
  const earnedUser = await contract.earned.call(user);
  log('==== printState', 'Original');
  log('totalSupply', totalSupply);
  log('balanceOfUser', balanceOfUser);
  log('lastTimeRewardApplicable', lastTimeRewardApplicable);
  log('lastUpdateTime', lastUpdateTime);
  log('rewardPerToken', rewardPerToken);
  log('rewardPerTokenStored', rewardPerTokenStored);
  log('earnedUser', earnedUser);
}
