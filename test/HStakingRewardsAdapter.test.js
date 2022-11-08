if (network.config.chainId == 1) {
  // This test supports to run on these chains.
} else {
  return;
}

const {
  balance,
  BN,
  constants,
  ether,
  expectRevert,
  time,
  send,
} = require('@openzeppelin/test-helpers');
const { tracker } = balance;
const { duration, increase } = time;
const abi = require('ethereumjs-abi');
const utils = web3.utils;

const { expect } = require('chai');

const {
  DAI_TOKEN,
  KNC_TOKEN,
  STAKING_REWARDS_ADAPTER_REGISTRY,
  STAKING_REWARDS_ADAPTER_REGISTRY_OWNER,
} = require('./utils/constants');
const {
  evmRevert,
  evmSnapshot,
  profileGas,
  getHandlerReturn,
  tokenProviderUniV2,
} = require('./utils/utils');

const FeeRuleRegistry = artifacts.require('FeeRuleRegistry');
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

contract('StakingRewardsAdapter - Handler', function([_, user, someone]) {
  let id;
  let balanceUser;
  /// st = stakingToken
  /// rt = rewardToken
  const stAddress = DAI_TOKEN;
  const rtAddress = KNC_TOKEN;

  let stProviderAddress;
  let rtProviderAddress;

  before(async function() {
    stProviderAddress = await tokenProviderUniV2(stAddress);
    rtProviderAddress = await tokenProviderUniV2(rtAddress);

    this.registry = await Registry.new();
    this.feeRuleRegistry = await FeeRuleRegistry.new('0', _);
    this.proxy = await Proxy.new(
      this.registry.address,
      this.feeRuleRegistry.address
    );
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
    await this.factory.newAdapter(
      this.staking.address,
      constants.ZERO_ADDRESS,
      constants.ZERO_ADDRESS
    );
    const adapterAddr = await this.factory.adapters.call(
      this.staking.address,
      0
    );

    await network.provider.request({
      method: 'hardhat_impersonateAccount',
      params: [STAKING_REWARDS_ADAPTER_REGISTRY_OWNER],
    });

    this.adapter = await StakingRewardsAdapter.at(adapterAddr);
    this.adapterRegistry = await StakingRewardsAdapterRegistry.at(
      STAKING_REWARDS_ADAPTER_REGISTRY
    );
    // Send some eth to owner for gas cost
    await send.ether(_, STAKING_REWARDS_ADAPTER_REGISTRY_OWNER, ether('1'));
    // Register adapter to AdapterRegistry
    await this.adapterRegistry.register(
      this.adapter.address,
      utils.asciiToHex('DAI-KNC'),
      { from: STAKING_REWARDS_ADAPTER_REGISTRY_OWNER }
    );
    // Deploy another adapter which will not be registered in AdapterRegistry
    await this.factory.newAdapter(
      this.staking.address,
      constants.ZERO_ADDRESS,
      constants.ZERO_ADDRESS
    );
    const unregisteredAdapterAddr = await this.factory.adapters.call(
      this.staking.address,
      1
    );
    this.unregisteredAdapter = await StakingRewardsAdapter.at(
      unregisteredAdapterAddr
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
      expect(earnedProxy).to.be.bignumber.zero;

      // Verify user gets whole share of adapter
      expect(earnedUser).to.be.bignumber.eq(earnedAdapter);

      // Check proxy balance
      expect(await this.st.balanceOf(this.proxy.address)).to.be.bignumber.zero;
      expect(await balance.current(this.proxy.address)).to.be.bignumber.zero;
      // Check user balance
      expect(await this.st.balanceOf(user)).to.be.bignumber.zero;
      expect(await balanceUser.delta()).to.be.bignumber.eq(ether('0'));
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

      const stBalanceBefore = await this.st.balanceOf(someone);
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
      expect(earnedProxy).to.be.bignumber.zero;
      expect(earnedSomeone).to.be.bignumber.zero;

      // Verify user gets whole share of adapter
      expect(earnedUser).to.be.bignumber.eq(earnedAdapter);

      // Check proxy balance
      expect(await this.st.balanceOf(this.proxy.address)).to.be.bignumber.zero;
      expect(await balance.current(this.proxy.address)).to.be.bignumber.zero;
      // Check user balance
      expect(await this.st.balanceOf(user)).to.be.bignumber.zero;
      expect(await balanceUser.delta()).to.be.bignumber.zero;
      // Check someone balance
      expect(await this.st.balanceOf(someone)).to.be.bignumber.eq(
        stBalanceBefore
      );
      profileGas(receipt);
    });

    it('unregistered adapter: stake', async function() {
      // Prepare staking data
      const sValue = ether('100');
      // Transfer stakingToken to proxy
      await this.st.transfer(this.proxy.address, sValue, {
        from: stProviderAddress,
      });
      await this.proxy.updateTokenMock(this.st.address);
      const data = abi.simpleEncode(
        'stake(address,uint256)',
        this.unregisteredAdapter.address,
        sValue
      );

      // Proxy stake to adapter for user
      await expectRevert(
        this.proxy.execMock(this.hAdapter.address, data, {
          from: user,
          value: ether('0.1'),
        }),
        'HStakingRewardsAdapter_General: Invalid adapter'
      );
    });

    it('unregistered adapter: stakeFor', async function() {
      // Prepare staking data
      const sValue = ether('100');
      // Transfer stakingToken to proxy
      await this.st.transfer(this.proxy.address, sValue, {
        from: stProviderAddress,
      });
      await this.proxy.updateTokenMock(this.st.address);
      const data = abi.simpleEncode(
        'stakeFor(address,address,uint256)',
        this.unregisteredAdapter.address,
        user,
        sValue
      );

      // Proxy stake to adapter for user initiated by someone
      await expectRevert(
        this.proxy.execMock(this.hAdapter.address, data, {
          from: someone,
          value: ether('0.1'),
        }),
        'HStakingRewardsAdapter_General: Invalid adapter'
      );
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
      expect(await this.st.balanceOf(this.proxy.address)).to.be.bignumber.zero;
      expect(await balance.current(this.proxy.address)).to.be.bignumber.zero;
      // Verify user staked amount has decreased
      expect(stakingUserAfter.sub(stakingUser)).to.be.bignumber.eq(
        ether('0').sub(sValue)
      );
      // Verify user receive unstaked token
      expect(stBalanceUserAfter.sub(stBalanceUser)).to.be.bignumber.eq(sValue);
      expect(await balanceUser.delta()).to.be.bignumber.eq(ether('0'));
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

    it('unregistered adapter', async function() {
      // Prepare staking data
      const sValue = ether('100');
      const rValue = ether('6048');
      await this.st.transfer(user, sValue, { from: stProviderAddress });

      // Stake by user self and proxy will withdrawFor user later
      await this.st.approve(this.unregisteredAdapter.address, sValue, {
        from: user,
      });
      await this.unregisteredAdapter.stake(sValue, { from: user });

      // Notify reward
      await this.rt.transfer(this.staking.address, rValue, {
        from: rtProviderAddress,
      });
      await this.staking.notifyRewardAmount(rValue, { from: _ });

      // User approve proxy as agent
      await this.unregisteredAdapter.setApproval(this.proxy.address, true, {
        from: user,
      });

      // Proxy withdrawFor user
      const data = abi.simpleEncode(
        'withdraw(address,uint256)',
        this.unregisteredAdapter.address,
        sValue
      );
      await expectRevert(
        this.proxy.execMock(this.hAdapter.address, data, {
          from: user,
          value: ether('0.1'),
        }),
        'HStakingRewardsAdapter_General: Invalid adapter'
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

      // Get handler return result
      const handlerReturn = getHandlerReturn(receipt, ['uint256', 'uint256']);

      // Get balance of user after withdrawFor
      const stakingUserAfter = await this.adapter.balanceOf.call(user);
      const stBalanceUserAfter = await this.st.balanceOf.call(user);
      const rtBalanceUserAfter = await this.rt.balanceOf.call(user);

      // Check proxy balance
      expect(await this.st.balanceOf(this.proxy.address)).to.be.bignumber.zero;
      expect(await this.rt.balanceOf(this.proxy.address)).to.be.bignumber.zero;
      expect(await balance.current(this.proxy.address)).to.be.bignumber.zero;
      // Verify user staked amount has decreased
      expect(stakingUserAfter.sub(stakingUser)).to.be.bignumber.eq(
        ether('0').sub(sValue)
      );
      // Verify user receive unstaked token
      expect(stBalanceUserAfter.sub(stBalanceUser)).to.be.bignumber.eq(sValue);
      expect(utils.toBN(handlerReturn[0])).to.be.bignumber.eq(sValue);
      // Verify user get the reward he earned
      expect(rtBalanceUserAfter).to.be.bignumber.gte(earnedUser);
      expect(rtBalanceUserAfter).to.be.bignumber.lte(getBuffer(earnedUser));
      expect(rtBalanceUserAfter).to.be.bignumber.eq(
        utils.toBN(handlerReturn[1])
      );
      expect(await balanceUser.delta()).to.be.bignumber.eq(ether('0'));
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

    it('unregistered adapter', async function() {
      // Prepare staking data
      const sValue = ether('100');
      const rValue = ether('6048');
      await this.st.transfer(user, sValue, { from: stProviderAddress });

      // Stake by user self and proxy will exitFor user later
      await this.st.approve(this.unregisteredAdapter.address, sValue, {
        from: user,
      });
      await this.unregisteredAdapter.stake(sValue, { from: user });

      // Notify reward
      await this.rt.transfer(this.staking.address, rValue, {
        from: rtProviderAddress,
      });
      await this.staking.notifyRewardAmount(rValue, { from: _ });

      // User approve proxy as agent
      await this.unregisteredAdapter.setApproval(this.proxy.address, true, {
        from: user,
      });

      // Proxy exitFor user
      const data = abi.simpleEncode(
        'exit(address)',
        this.unregisteredAdapter.address
      );
      await expectRevert(
        this.proxy.execMock(this.hAdapter.address, data, {
          from: user,
          value: ether('0.1'),
        }),
        'HStakingRewardsAdapter_General: Invalid adapter'
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

      // Get handler return result
      const handlerReturn = utils.toBN(
        getHandlerReturn(receipt, ['uint256'])[0]
      );
      // Get balance of user after withdrawFor
      const stakingUserAfter = await this.adapter.balanceOf.call(user);
      const stBalanceUserAfter = await this.st.balanceOf.call(user);
      const rtBalanceUserAfter = await this.rt.balanceOf.call(user);

      // Check proxy balance
      expect(await this.st.balanceOf(this.proxy.address)).to.be.bignumber.zero;
      expect(await this.rt.balanceOf(this.proxy.address)).to.be.bignumber.zero;
      expect(await balance.current(this.proxy.address)).to.be.bignumber.zero;
      // Verify user staked amount does not changed
      expect(stakingUserAfter).to.be.bignumber.eq(sValue);
      // Verify user not being unstaked unexpectedlly and get the staking token
      expect(stBalanceUserAfter).to.be.bignumber.zero;
      // Verify user get the reward he earned
      expect(rtBalanceUserAfter).to.be.bignumber.gte(earnedUser);
      expect(rtBalanceUserAfter).to.be.bignumber.lte(getBuffer(earnedUser));
      expect(rtBalanceUserAfter).to.be.bignumber.eq(handlerReturn);
      expect(await balanceUser.delta()).to.be.bignumber.eq(ether('0'));
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

    it('unregistered adapter', async function() {
      // Prepare staking data
      const sValue = ether('100');
      const rValue = ether('6048');
      await this.st.transfer(user, sValue, { from: stProviderAddress });

      // Stake by user self and proxy will getRewardFor user later
      await this.st.approve(this.unregisteredAdapter.address, sValue, {
        from: user,
      });
      await this.unregisteredAdapter.stake(sValue, { from: user });

      // Notify reward
      await this.rt.transfer(this.staking.address, rValue, {
        from: rtProviderAddress,
      });
      await this.staking.notifyRewardAmount(rValue, { from: _ });

      // User approve proxy as agent
      await this.unregisteredAdapter.setApproval(this.proxy.address, true, {
        from: user,
      });

      // Proxy getRewardFor user
      const data = abi.simpleEncode(
        'getReward(address)',
        this.unregisteredAdapter.address
      );
      await expectRevert(
        this.proxy.execMock(this.hAdapter.address, data, {
          from: user,
          value: ether('0.1'),
        }),
        'HStakingRewardsAdapter_General: Invalid adapter'
      );
    });
  });
});

function getBuffer(num) {
  return new BN(num).mul(new BN(1001)).div(new BN(1000));
}
