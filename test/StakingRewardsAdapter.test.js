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
const { latest } = time;
const abi = require('ethereumjs-abi');
const utils = web3.utils;

const { expect } = require('chai');

const { DAI_TOKEN, DAI_PROVIDER, ZRX_TOKEN, ZRX_PROVIDER } = require('./utils/constants');
const { resetAccount, profileGas } = require('./utils/utils');

const StakingRewards = artifacts.require('StakingRewards');
const StakingRewardsAdapter = artifacts.require('StakingRewardsAdapter');
const IToken = artifacts.require('IERC20');

contract('StakingRewardsAdapter', function([_, deployer, user]) {
  /// st = stakingToken
  /// rt = rewardToken
  const stAddress = DAI_TOKEN;
  const stProviderAddress = DAI_PROVIDER;
  const rtAddress = ZRX_TOKEN;
  const rtProviderAddress = ZRX_PROVIDER;

  before(async function() {
    this.st = await IToken.at(stAddress);
    this.rt = await IToken.at(rtAddress);
    this.staking = await StakingRewards.new(_, rtProviderAddress, rtAddress, stAddress);
    this.adapter = await StakingRewardsAdapter.new(_, this.staking.address);
  });

  // beforeEach(async function() {
  //   await resetAccount(_);
  //   await resetAccount(user);
  // });

  // describe('deposit', function() {
  //   beforeEach(async function() {
  //     tokenUserAmount = await this.token.balanceOf.call(user);
  //     balanceProxy = await tracker(this.proxy.address);
  //     balanceUser = await tracker(user);
  //   });

  //   it('normal', async function() {
  //     // Prepare handler data
  //     const token = this.token.address;
  //     const value = ether('10');
  //     const to = this.hWeth.address;
  //     const data = abi.simpleEncode('deposit(uint256)', value);

  //     // Send tokens to proxy
  //     const receipt = await this.proxy.execMock(to, data, {
  //       from: user,
  //       value: value,
  //     });

  //     // Verify proxy balance should be zero
  //     expect(await balanceProxy.get()).to.be.bignumber.eq(ether('0'));
  //     expect(
  //       await this.token.balanceOf.call(this.proxy.address)
  //     ).to.be.bignumber.eq(ether('0'));

  //     // Verify user balance
  //     expect(await this.token.balanceOf.call(user)).to.be.bignumber.eq(
  //       tokenUserAmount.add(value)
  //     );
  //     expect(await balanceUser.delta()).to.be.bignumber.eq(
  //       ether('0')
  //         .sub(value)
  //         .sub(new BN(receipt.receipt.gasUsed))
  //     );

  //     profileGas(receipt);
  //   });
  // });

});
