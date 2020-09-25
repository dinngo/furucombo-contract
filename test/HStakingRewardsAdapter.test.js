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
  CREATE2_FACTORY,
  STAKING_REWARDS_ADAPTER_REGISTRY_SALT,
  STAKING_REWARDS_ADAPTER_REGISTRY,
} = require('./utils/constants');
const { evmRevert, evmSnapshot, profileGas } = require('./utils/utils');

const Registry = artifacts.require('Registry');
const Proxy = artifacts.require('ProxyMock');
const HStakingRewardsAdapter = artifacts.require('HStakingRewardsAdapter');
const StakingRewards = artifacts.require('StakingRewards');
const StakingRewardsAdapter = artifacts.require('StakingRewardsAdapter');
const StakingRewardsAdapterFactory = artifacts.require(
  'StakingRewardsAdapterFactory'
);
const StakingRewardsAdapterRegistry = artifacts.require(
  'StakingRewardsAdapterRegistry'
);
const IToken = artifacts.require('IERC20');
const ISingletonFactory = artifacts.require('ISingletonFactory');

contract('StakingRewardsAdapter - Handler', function([_, user, someone]) {
  let id;
  let balanceUser;
  /// Get AdapterRegistry bytecode to deploy using CREATE2
  const bytecode = StakingRewardsAdapterRegistry.bytecode;
  /// st = stakingToken
  /// rt = rewardToken
  const stAddress = DAI_TOKEN;
  const stProviderAddress = DAI_PROVIDER;
  const rtAddress = KNC_TOKEN;
  const rtProviderAddress = KNC_PROVIDER;

  before(async function() {
    this.registry = await Registry.new();
    this.proxy = await Proxy.new(this.registry.address);
    this.hAdapter = await HStakingRewardsAdapter.new();
    await this.registry.register(
      this.hAdapter.address,
      utils.asciiToHex('HStakingRewardsAdapter')
    );
    this.st = await IToken.at(stAddress);
    this.rt = await IToken.at(rtAddress);
    this.staking = await StakingRewards.new(_, _, rtAddress, stAddress);
    // Deploy new adapter through factory
    this.factory = await StakingRewardsAdapterFactory.new();
    await this.factory.newAdapter(this.staking.address);
    const adapterAddr = await this.factory.adapters.call(
      this.staking.address,
      0
    );
    // Use SingletonFactory to deploy AdapterRegistry using CREATE2
    this.singletonFactory = await ISingletonFactory.at(CREATE2_FACTORY);
    await this.singletonFactory.deploy(bytecode, STAKING_REWARDS_ADAPTER_REGISTRY_SALT);
    this.adapter = await StakingRewardsAdapter.at(adapterAddr);
    this.adapterRegistry = await StakingRewardsAdapterRegistry.at(
      STAKING_REWARDS_ADAPTER_REGISTRY
    );
    // Register adapter to AdapterRegistry
    await this.adapterRegistry.register(
      this.adapter.address,
      utils.asciiToHex('DAI-KNC'),
    );
  });

  beforeEach(async function() {
    id = await evmSnapshot();
  });

  afterEach(async function() {
    await evmRevert(id);
  });

  describe('Stake', function() {
    beforeEach(async function() {
      rewardUserAmount = await this.rt.balanceOf.call(user);
      balanceUser = await tracker(user);
    });

    it('stake for msg.sender', async function() {
      // Prepare staking data
      const sValue = ether('100');
      const rValue = ether('6048');
      // Transfer stakingToken to proxy
      await this.st.transfer(this.proxy.address, sValue, {
        from: stProviderAddress,
      });
      await this.proxy.updateTokenMock(this.st.address);
      const data = abi.simpleEncode(
        'stake(address,uint256)',
        this.adapter.address,
        sValue
      );

      // Proxy stake to adapter for user
      const receipt = await this.proxy.execMock(this.hAdapter.address, data, {
        from: user,
        value: ether('0.1'),
      });

      // Notify reward
      await this.rt.transfer(this.staking.address, rValue, {
        from: rtProviderAddress,
      });
      await this.staking.notifyRewardAmount(rValue, { from: _ });

      // Make time elapsed
      await increase(duration.days(1));

      const earnedAdapter = await this.staking.earned.call(
        this.adapter.address
      );
      const earnedUser = await this.adapter.earned.call(user);
      const earnedProxy = await this.adapter.earned.call(this.proxy.address);

      // Verify everyone gets reward
      expect(earnedUser).to.be.bignumber.gt(ether('0'));
      expect(earnedAdapter).to.be.bignumber.gt(ether('0'));
      // Verify proxy not unexpectedlly earn any reward
      expect(earnedProxy).to.be.zero;

      // Verify user gets whole share of adapter
      expect(earnedUser).to.be.bignumber.eq(earnedAdapter);

      // Check proxy balance
      expect(await this.st.balanceOf(this.proxy.address)).to.be.zero;
      expect(await balance.current(this.proxy.address)).to.be.zero;
      // Check user balance
      expect(await this.st.balanceOf(user)).to.be.zero;
      expect(await balanceUser.delta()).to.be.bignumber.eq(
        ether('0').sub(new BN(receipt.receipt.gasUsed))
      );
      profileGas(receipt);
    });

    it('stake for others', async function() {
      // Prepare staking data
      const sValue = ether('100');
      const rValue = ether('6048');
      // Transfer stakingToken to proxy
      await this.st.transfer(this.proxy.address, sValue, {
        from: stProviderAddress,
      });
      await this.proxy.updateTokenMock(this.st.address);
      const data = abi.simpleEncode(
        'stakeFor(address,address,uint256)',
        this.adapter.address,
        user,
        sValue
      );

      // Proxy stake to adapter for user initiated by someone
      const receipt = await this.proxy.execMock(this.hAdapter.address, data, {
        from: someone,
        value: ether('0.1'),
      });

      // Notify reward
      await this.rt.transfer(this.staking.address, rValue, {
        from: rtProviderAddress,
      });
      await this.staking.notifyRewardAmount(rValue, { from: _ });

      // Make time elapsed
      await increase(duration.days(1));

      const earnedAdapter = await this.staking.earned.call(
        this.adapter.address
      );
      const earnedUser = await this.adapter.earned.call(user);
      const earnedProxy = await this.adapter.earned.call(this.proxy.address);
      const earnedSomeone = await this.adapter.earned.call(someone);

      // Verify everyone gets reward
      expect(earnedUser).to.be.bignumber.gt(ether('0'));
      expect(earnedAdapter).to.be.bignumber.gt(ether('0'));
      // Verify proxy not unexpectedlly earn any reward
      expect(earnedProxy).to.be.zero;
      expect(earnedSomeone).to.be.zero;

      // Verify user gets whole share of adapter
      expect(earnedUser).to.be.bignumber.eq(earnedAdapter);

      // Check proxy balance
      expect(await this.st.balanceOf(this.proxy.address)).to.be.zero;
      expect(await balance.current(this.proxy.address)).to.be.zero;
      // Check user balance
      expect(await this.st.balanceOf(user)).to.be.zero;
      expect(await balanceUser.delta()).to.be.zero;
      // Check someone balance
      expect(await this.st.balanceOf(someone)).to.be.zero;
      profileGas(receipt);
    });
  });

  describe('Withdraw', function() {
    beforeEach(async function() {
      rewardUserAmount = await this.rt.balanceOf.call(user);
      balanceUser = await tracker(user);
    });

    it('authorized', async function() {
      // Prepare staking data
      const sValue = ether('100');
      const rValue = ether('6048');
      await this.st.transfer(user, sValue, { from: stProviderAddress });

      // Stake by user self and proxy will withdrawFor user later
      await this.st.approve(this.adapter.address, sValue, { from: user });
      await this.adapter.stake(sValue, { from: user });

      // Notify reward
      await this.rt.transfer(this.staking.address, rValue, {
        from: rtProviderAddress,
      });
      await this.staking.notifyRewardAmount(rValue, { from: _ });

      // Make time elapsed
      await increase(duration.days(1));

      // Get balance of user before withdrawFor
      const stakingUser = await this.adapter.balanceOf.call(user);
      const stBalanceUser = await this.st.balanceOf.call(user);

      // User approve proxy as agent
      await this.adapter.setApproval(this.proxy.address, true, { from: user });

      // Proxy withdrawFor user
      const data = abi.simpleEncode(
        'withdraw(address,uint256)',
        this.adapter.address,
        sValue
      );
      await balanceUser.get();
      const receipt = await this.proxy.execMock(this.hAdapter.address, data, {
        from: user,
        value: ether('0.1'),
      });

      // Get balance of user after withdrawFor
      const stakingUserAfter = await this.adapter.balanceOf.call(user);
      const stBalanceUserAfter = await this.st.balanceOf.call(user);

      // Check proxy balance
      expect(await this.st.balanceOf(this.proxy.address)).to.be.zero;
      expect(await balance.current(this.proxy.address)).to.be.zero;
      // Verify user staked amount has decreased
      expect(stakingUserAfter.sub(stakingUser)).to.be.bignumber.eq(
        ether('0').sub(sValue)
      );
      // Verify user receive unstaked token
      expect(stBalanceUserAfter.sub(stBalanceUser)).to.be.bignumber.eq(sValue);
      expect(await balanceUser.delta()).to.be.bignumber.eq(
        ether('0').sub(new BN(receipt.receipt.gasUsed))
      );
      profileGas(receipt);
    });

    it('unauthorized', async function() {
      // Prepare staking data
      const sValue = ether('100');
      const rValue = ether('6048');
      await this.st.transfer(user, sValue, { from: stProviderAddress });

      // Stake by user self and proxy will withdrawFor user later
      await this.st.approve(this.adapter.address, sValue, { from: user });
      await this.adapter.stake(sValue, { from: user });

      // Notify reward
      await this.rt.transfer(this.staking.address, rValue, {
        from: rtProviderAddress,
      });
      await this.staking.notifyRewardAmount(rValue, { from: _ });

      // Make time elapsed
      await increase(duration.days(1));

      // Proxy withdrawFor user
      const data = abi.simpleEncode(
        'withdraw(address,uint256)',
        this.adapter.address,
        sValue
      );
      await balanceUser.get();
      await expectRevert(
        this.proxy.execMock(this.hAdapter.address, data, {
          from: user,
          value: ether('0.1'),
        }),
        'StakingRewardsAdapter: agent not been approved'
      );
    });
  });

  describe('Exit', function() {
    beforeEach(async function() {
      rewardUserAmount = await this.rt.balanceOf.call(user);
      balanceUser = await tracker(user);
    });

    it('authorized', async function() {
      // Prepare staking data
      const sValue = ether('100');
      const rValue = ether('6048');
      await this.st.transfer(user, sValue, { from: stProviderAddress });

      // Stake by user self and proxy will exitFor user later
      await this.st.approve(this.adapter.address, sValue, { from: user });
      await this.adapter.stake(sValue, { from: user });

      // Notify reward
      await this.rt.transfer(this.staking.address, rValue, {
        from: rtProviderAddress,
      });
      await this.staking.notifyRewardAmount(rValue, { from: _ });

      // Make time elapsed
      await increase(duration.days(1));

      // Get balance of user before exitFor
      const stakingUser = await this.adapter.balanceOf.call(user);
      const stBalanceUser = await this.st.balanceOf.call(user);
      // Get the amount user earned
      const earnedUser = await this.adapter.earned.call(user);

      // User approve proxy as agent
      await this.adapter.setApproval(this.proxy.address, true, { from: user });

      // Proxy exitFor user
      const data = abi.simpleEncode('exit(address)', this.adapter.address);
      await balanceUser.get();
      const receipt = await this.proxy.execMock(this.hAdapter.address, data, {
        from: user,
        value: ether('0.1'),
      });

      // Get balance of user after withdrawFor
      const stakingUserAfter = await this.adapter.balanceOf.call(user);
      const stBalanceUserAfter = await this.st.balanceOf.call(user);
      const rtBalanceUserAfter = await this.rt.balanceOf.call(user);

      // Check proxy balance
      expect(await this.st.balanceOf(this.proxy.address)).to.be.zero;
      expect(await this.rt.balanceOf(this.proxy.address)).to.be.zero;
      expect(await balance.current(this.proxy.address)).to.be.zero;
      // Verify user staked amount has decreased
      expect(stakingUserAfter.sub(stakingUser)).to.be.bignumber.eq(
        ether('0').sub(sValue)
      );
      // Verify user receive unstaked token
      expect(stBalanceUserAfter.sub(stBalanceUser)).to.be.bignumber.eq(sValue);
      // Verify user get the reward he earned
      expect(rtBalanceUserAfter).to.be.bignumber.gte(earnedUser);
      expect(rtBalanceUserAfter).to.be.bignumber.lte(getBuffer(earnedUser));
      expect(await balanceUser.delta()).to.be.bignumber.eq(
        ether('0').sub(new BN(receipt.receipt.gasUsed))
      );
      profileGas(receipt);
    });

    it('unauthorized', async function() {
      // Prepare staking data
      const sValue = ether('100');
      const rValue = ether('6048');
      await this.st.transfer(user, sValue, { from: stProviderAddress });

      // Stake by user self and proxy will exitFor user later
      await this.st.approve(this.adapter.address, sValue, { from: user });
      await this.adapter.stake(sValue, { from: user });

      // Notify reward
      await this.rt.transfer(this.staking.address, rValue, {
        from: rtProviderAddress,
      });
      await this.staking.notifyRewardAmount(rValue, { from: _ });

      // Make time elapsed
      await increase(duration.days(1));

      // Proxy exitFor user
      const data = abi.simpleEncode('exit(address)', this.adapter.address);
      await expectRevert(
        this.proxy.execMock(this.hAdapter.address, data, {
          from: user,
          value: ether('0.1'),
        }),
        'StakingRewardsAdapter: agent not been approved'
      );
    });
  });

  describe('GetReward', function() {
    beforeEach(async function() {
      rewardUserAmount = await this.rt.balanceOf.call(user);
      balanceUser = await tracker(user);
    });

    it('authorized', async function() {
      // Prepare staking data
      const sValue = ether('100');
      const rValue = ether('6048');
      await this.st.transfer(user, sValue, { from: stProviderAddress });

      // Stake by user self and proxy will getRewardFor user later
      await this.st.approve(this.adapter.address, sValue, { from: user });
      await this.adapter.stake(sValue, { from: user });

      // Notify reward
      await this.rt.transfer(this.staking.address, rValue, {
        from: rtProviderAddress,
      });
      await this.staking.notifyRewardAmount(rValue, { from: _ });

      // Make time elapsed
      await increase(duration.days(1));

      // Get the amount user earned
      const earnedUser = await this.adapter.earned.call(user);

      // User approve proxy as agent
      await this.adapter.setApproval(this.proxy.address, true, { from: user });

      // Proxy getRewardFor user
      const data = abi.simpleEncode('getReward(address)', this.adapter.address);
      await balanceUser.get();
      const receipt = await this.proxy.execMock(this.hAdapter.address, data, {
        from: user,
        value: ether('0.1'),
      });

      // Get balance of user after withdrawFor
      const stakingUserAfter = await this.adapter.balanceOf.call(user);
      const stBalanceUserAfter = await this.st.balanceOf.call(user);
      const rtBalanceUserAfter = await this.rt.balanceOf.call(user);

      // Check proxy balance
      expect(await this.st.balanceOf(this.proxy.address)).to.be.zero;
      expect(await this.rt.balanceOf(this.proxy.address)).to.be.zero;
      expect(await balance.current(this.proxy.address)).to.be.zero;
      // Verify user staked amount does not changed
      expect(stakingUserAfter).to.be.bignumber.eq(sValue);
      // Verify user not being unstaked unexpectedlly and get the staking token
      expect(stBalanceUserAfter).to.be.zero;
      // Verify user get the reward he earned
      expect(rtBalanceUserAfter).to.be.bignumber.gte(earnedUser);
      expect(rtBalanceUserAfter).to.be.bignumber.lte(getBuffer(earnedUser));
      expect(await balanceUser.delta()).to.be.bignumber.eq(
        ether('0').sub(new BN(receipt.receipt.gasUsed))
      );
      profileGas(receipt);
    });

    it('unauthorized', async function() {
      // Prepare staking data
      const sValue = ether('100');
      const rValue = ether('6048');
      await this.st.transfer(user, sValue, { from: stProviderAddress });

      // Stake by user self and proxy will getRewardFor user later
      await this.st.approve(this.adapter.address, sValue, { from: user });
      await this.adapter.stake(sValue, { from: user });

      // Notify reward
      await this.rt.transfer(this.staking.address, rValue, {
        from: rtProviderAddress,
      });
      await this.staking.notifyRewardAmount(rValue, { from: _ });

      // Make time elapsed
      await increase(duration.days(1));

      // Proxy getRewardFor user
      const data = abi.simpleEncode('getReward(address)', this.adapter.address);
      await balanceUser.get();
      await expectRevert(
        this.proxy.execMock(this.hAdapter.address, data, {
          from: user,
          value: ether('0.1'),
        }),
        'StakingRewardsAdapter: agent not been approved'
      );
    });
  });
});

function getBuffer(num) {
  return new BN(num).mul(new BN(1001)).div(new BN(1000));
}
