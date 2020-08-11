const { BN, ether } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');
const abi = require('ethereumjs-abi');
const utils = web3.utils;
const {
  DAI_TOKEN,
  USDT_TOKEN,
  TUSD_TOKEN,
  SUSD_TOKEN,
  WBTC_TOKEN,
  RENBTC_TOKEN,
  USDT_PROVIDER,
  SUSD_PROVIDER,
  WBTC_PROVIDER,
  CURVE_Y_SWAP,
  CURVE_SBTC_SWAP,
  CURVE_ONE_SPLIT,
} = require('./utils/constants');
const { resetAccount, profileGas } = require('./utils/utils');

const Proxy = artifacts.require('ProxyMock');
const Registry = artifacts.require('Registry');
const HCurveDao = artifacts.require('HCurveDao');
const IMinter = artifacts.require('IMinter');
const ILiquidityGuage = artifacts.require('ILiquidityGuage');
const IToken = artifacts.require('IERC20');

contract('Curve DAO', function([_, deployer, user1, user2]) {
  // Wait for the gaude to be ready
  const token0Address = ZERO_ADDRESS;
  const token1Address = ZERO_ADDRESS;
  const token0Provider = ZERO_ADDRESS;
  const token1Provider = ZERO_ADDRESS;
  const gauge0Address = ZERO_ADDRESS;
  const gauge1Address = ZERO_ADDRESS;
  const gauge0amount = ether('1');
  const gauge1amount = ether('1');

  before(async function() {
    this.registry = await Registry.new();
    this.hminter = await HCurveDao.new();
    await this.registry.register(
      this.hminter.address,
      utils.asciiToHex('HCurveDao')
    );
    this.token0 = await IToken.at(token0Address);
    this.token1 = await IToken.at(token1Address);
    this.gauge0 = await ILiquidityGuage.at(gauge0Address);
    this.gauge1 = await ILiquidityGuage.at(gauge1Address);
  });

  beforeEach(async function() {
    await resetAccount(_);
    await resetAccount(user);
    this.proxy = await Proxy.new(this.registry.address);
  });

  describe('Deposit lp token to gauge', function() {
    it('normal', async function() {
      await this.token0.transfer(this.proxy.address, gauge0Amount, {
        from: providerAddress,
      });
      const to = this.HCurveDao.address;
      const data = abi.simpleEncode(
        'deposit(address,uint256)',
        this.gauge0.address,
        gauge0Amount
      );
      await this.gauge0.set_approve_deposit(this.proxy.address, true, {
        from: user1,
      });

      const receipt = await this.proxy.execMock(to, data, {
        from: user1,
        value: ether('0.1'),
      });
    });
  });

  describe('Claim CRV', function() {
    describe('from single gauge', function() {
      beforeEach(async function() {
        await this.token0.transfer(user1, gauge0Amount, {
          from: token0Provider,
        });
        await this.gauge0.deposit(gauge0Amount, { from: user1 });
      });

      afterEach(async function() {
        const rest0 = await this.gauge0.balanceOf.call(user1);
        await this.minter.mint(this.gauge0.address, { from: user1 });
        await this.gauge0.withdraw(rest0, { from: user1 });
      });

      it('normal', async function() {
        await this.minter.toggle_approve_mint(this.proxy.address, {
          from: user1,
        });
        const to = this.HCurveDao.address;
        const data = abi.simpleEncode(
          'mint_for(address,address)',
          this.gauge0.address,
          user1
        );
        const receipt = await this.proxy.execMock(to, data, {
          from: user1,
          value: ether('0.1'),
        });
      });
    });

    describe('from multiple gauges', function() {
      beforeEach(async function() {
        await this.token0.transfer(user2, gauge0Amount, {
          from: token0Provider,
        });
        await this.token1.transfer(user2, gauge1Amount, {
          from: token1Provider,
        });
        await this.gauge0.deposit(gauge0Amount, { from: user2 });
        await this.gauge1.deposit(gauge1Amount, { from: user2 });
      });

      afterEach(async function() {
        const rest0 = await this.gauge0.balanceOf.call(user2);
        const rest1 = await this.gauge0.balanceOf.call(user2);
        await this.minter.mint(this.gauge0.address, { from: user2 });
        await this.minter.mint(this.gauge1.address, { from: user2 });
        await this.gauge0.withdraw(rest0, { from: user2 });
        await this.gauge0.withdraw(rest1, { from: user2 });
      });

      it('normal', async function() {
        await this.minter.toggle_approve_mint(this.proxy.address, {
          from: user2,
        });
        const to = this.HCurveDao.address;
        const data = abi.simpleEncode(
          'mint_for_many(address[],address)',
          [this.gauge0.address, this.gauge1.address],
          user2
        );
        const receipt = await this.proxy.execMock(to, data, {
          from: user2,
          value: ether('0.1'),
        });
      });
    });
  });
});
