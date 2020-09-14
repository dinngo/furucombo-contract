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

contract('StakingRewardsAdapter', function([_, user0, user1, user2, pauser]) {
  let id;
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

  describe('Stake by oneself', function() {
    beforeEach(async function() {
      rewardUser0Amount = await this.rt.balanceOf.call(user0);
      rewardUser1Amount = await this.rt.balanceOf.call(user1);
      rewardUser2Amount = await this.rt.balanceOf.call(user2);
    });

    it('1 on original - 1 on adapter', async function() {
      // Prepare staking data
      const sValue = ether('100');
      const rValue = ether('6048');
      await this.st.transfer(user0, sValue, { from: stProviderAddress });
      await this.st.transfer(user1, sValue, { from: stProviderAddress });

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

      const earnedAdapter = await this.staking.earned.call(
        this.adapter.address
      );
      const earnedUser0 = await this.staking.earned.call(user0);
      const earnedUser1 = await this.adapter.earned.call(user1);

      log('staking address', this.staking.address);
      log('adapter address', this.adapter.address);
      log('staking token', this.st.address);
      log('reward  token', this.rt.address);
      log('user0', user0);
      log('user1', user1);
      log('earnedAdapter', earnedAdapter);
      log('earnedUser0', earnedUser0);
      log('earnedUser1', earnedUser1);
      await printStateAdapter(this.adapter.address, user1);
      await printStateOriginal(this.staking.address, user0);

      // Verify everyone gets reward
      expect(earnedUser0).to.be.bignumber.gt(ether('0'));
      expect(earnedUser1).to.be.bignumber.gt(ether('0'));
      expect(earnedAdapter).to.be.bignumber.gt(ether('0'));

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

    it('1 on original - 2 on adapter', async function() {
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

      const earnedAdapter = await this.staking.earned.call(
        this.adapter.address
      );
      const earnedUser0 = await this.staking.earned.call(user0);
      const earnedUser1 = await this.adapter.earned.call(user1);
      const earnedUser2 = await this.adapter.earned.call(user2);

      log('staking address', this.staking.address);
      log('adapter address', this.adapter.address);
      log('staking token', this.st.address);
      log('reward  token', this.rt.address);
      log('user0', user0);
      log('user1', user1);
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

    it('1 on original - 2 on adapter - one stake in the middle', async function() {
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

      // User2 stake through adapter
      await this.st.approve(this.adapter.address, sValue, { from: user2 });
      await this.adapter.stake(sValue, { from: user2 });

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

      // Verify everyone gets reward
      expect(earnedUser0).to.be.bignumber.gt(ether('0'));
      expect(earnedUser1).to.be.bignumber.gt(ether('0'));
      expect(earnedUser2).to.be.bignumber.gt(ether('0'));
      expect(earnedAdapter).to.be.bignumber.gt(ether('0'));

      // Verify user0 & user1 gets equal share
      expect(earnedUser0).to.be.bignumber.eq(earnedUser1);
      // Verify earnedAdapter = user1 + user2
      expect(earnedAdapter).to.be.bignumber.eq(earnedUser1.add(earnedUser2));
    });

    it('1 on original - 2 on adapter - one exit in the middle', async function() {
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

      // User2 exit
      const earnedUser2 = await this.adapter.earned.call(user2);
      await this.adapter.exit({ from: user2 });
      const rewardUser2AmountAfter = await this.rt.balanceOf(user2);
      const rewardUser2Got = rewardUser2AmountAfter.sub(rewardUser2Amount);

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

      // Verify everyone gets reward
      expect(earnedUser0).to.be.bignumber.gt(ether('0'));
      expect(earnedUser1).to.be.bignumber.gt(ether('0'));
      expect(earnedUser2).to.be.bignumber.gt(ether('0'));
      expect(totalRewardAdapter).to.be.bignumber.gt(ether('0'));

      // Verify user0 & user1 gets equal share
      expect(earnedUser0).to.be.bignumber.eq(earnedUser1);
      // Verify user1 gets whole share of adapter after user2 claimed
      expect(earnedUser1).to.be.bignumber.eq(totalRewardAdapter);
      // Verify user2 gets the amount he earned
      expect(rewardUser2Got).to.be.bignumber.gte(earnedUser2);
      expect(rewardUser2Got).to.be.bignumber.lte(getBuffer(earnedUser2));
      log('rewardUser2Got', rewardUser2Got);
      // Verify user2 unstake all share by using exit
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

    it('1 on original - 2 on adapter - one getReward in the middle', async function() {
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

      // User2 get current reward but not unstake
      const earnedUser2Middle = await this.adapter.earned.call(user2);
      await this.adapter.getReward({ from: user2 });
      const rewardUser2Middle = await this.rt.balanceOf.call(user2);
      log('rewardUser2Middle', rewardUser2Middle);

      // Make time elapsed
      await increase(duration.days(1));

      // Get the state after user2 get his reward at that moment
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

      // Verify everyone gets reward
      expect(earnedUser0).to.be.bignumber.gt(ether('0'));
      expect(earnedUser1).to.be.bignumber.gt(ether('0'));
      expect(earnedUser2End).to.be.bignumber.gt(ether('0'));
      expect(totalRewardAdapter).to.be.bignumber.gt(ether('0'));

      // Verify user0 & user1 gets equal share
      expect(earnedUser0).to.be.bignumber.eq(earnedUser1);
      // Verify user1 gets equal amount to user2's overall reward
      expect(earnedUser1).to.be.bignumber.eq(
        rewardUser2Middle.add(earnedUser2End)
      );
      // Verify user2 earnedAmountMiddle equals to his rt balance after getReward
      expect(rewardUser2Middle).to.be.bignumber.gte(earnedUser2Middle);
      expect(rewardUser2Middle).to.be.bignumber.lte(
        getBuffer(earnedUser2Middle)
      );
      // Verify adapter earned overall equals to 2x of user0 has earned
      expect(totalRewardAdapter.add(rewardUser2Middle)).to.be.bignumber.eq(
        earnedUser0.mul(new BN('2'))
      );
    });

    it('1 on original - 1 on adapter - notify reward twice', async function() {
      // Prepare staking data
      const sValue = ether('100');
      const rValue = ether('6048');
      await this.st.transfer(user0, sValue, { from: stProviderAddress });
      await this.st.transfer(user1, sValue, { from: stProviderAddress });

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

      // Notify reward second time
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

      log('staking address', this.staking.address);
      log('adapter address', this.adapter.address);
      log('staking token', this.st.address);
      log('reward  token', this.rt.address);
      log('user0', user0);
      log('user1', user1);
      log('earnedAdapter', earnedAdapter);
      log('earnedUser0', earnedUser0);
      log('earnedUser1', earnedUser1);
      await printStateAdapter(this.adapter.address, user1);
      await printStateOriginal(this.staking.address, user0);

      // Verify everyone gets reward
      expect(earnedUser0).to.be.bignumber.gt(ether('0'));
      expect(earnedUser1).to.be.bignumber.gt(ether('0'));
      expect(earnedAdapter).to.be.bignumber.gt(ether('0'));

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

    it('paused -> unpaused -> stake', async function() {
      // Prepare staking data
      const sValue = ether('100');
      await this.st.transfer(user1, sValue, { from: stProviderAddress });
      // User approve st to adapter
      await this.st.approve(this.adapter.address, sValue, { from: user1 });
      // Add pauser
      await this.adapter.addPauser(pauser, {from: _});
      // Set paused on adapter
      await this.adapter.pause({from: pauser});
      // Should revert on stake when paused
      await expectRevert(this.adapter.stake(sValue, { from: user1 }), 'Pausable: paused');
      // Set unpaused on adapter
      await this.adapter.unpause({from: _});
      // Should success when not paused
      await this.adapter.stake(sValue, { from: user1 });
      const stakingUser1 = await this.adapter.balanceOf.call(user1);
      expect(stakingUser1).to.be.bignumber.eq(stakingUser1);
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
