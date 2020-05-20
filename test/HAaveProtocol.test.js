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
const util = require('ethereumjs-util');
const utils = web3.utils;

const { expect } = require('chai');

const {
  ETH_TOKEN,
  ETH_PROVIDER,
  DAI_TOKEN,
  DAI_PROVIDER,
  AAVEPROTOCOL_PROVIDER,
  AETHER,
  ADAI
} = require('./utils/constants');
const { resetAccount, profileGas } = require('./utils/utils');

const HAave = artifacts.require('HAaveProtocol');
const Registry = artifacts.require('Registry');
const Proxy = artifacts.require('ProxyMock');
const IToken = artifacts.require('IERC20');
const IAToken = artifacts.require('IAToken');
const ILendingPool = artifacts.require('ILendingPool');
const IProvider = artifacts.require('ILendingPoolAddressesProvider');

contract('Aave', function([_, deployer, user]) {
  const atokenAddress = ADAI;
  const tokenAddress = DAI_TOKEN;
  const providerAddress = DAI_PROVIDER;
  
  let balanceUser;
  let balanceProxy;
  let aetherUser;
  let atokenUser;

  before(async function() {
    this.registry = await Registry.new();
    this.proxy = await Proxy.new(this.registry.address);
    this.haave = await HAave.new();
    await this.registry.register(
      this.haave.address,
      utils.asciiToHex('Aave Protocol')
    );
    this.provider = await IProvider.at(AAVEPROTOCOL_PROVIDER);
    this.lendingPoolCoreAddress = await this.provider.getLendingPoolCore.call();
    this.lendingPoolAddress = await this.provider.getLendingPool.call();
    this.lendingPool = await ILendingPool.at(this.lendingPoolAddress);
    await this.registry.register(this.lendingPoolAddress, this.haave.address);
    this.aether = await IAToken.at(AETHER);
    this.token = await IToken.at(tokenAddress);
    this.atoken = await IAToken.at(atokenAddress);
  });

  beforeEach(async function() {
    await resetAccount(_);
    await resetAccount(user);
    balanceUser = await tracker(user);
    balanceProxy = await tracker(this.proxy.address);
  });

  describe('Deposit', function() {
    it('ETH', async function() {
      const value = ether('10');
      const to = this.haave.address;
      const data = abi.simpleEncode(
        'deposit(address,uint256)',
        ETH_TOKEN,
        value
      );
      const receipt = await this.proxy.execMock(
        to, 
        data, 
        { from: user, value: value }
      );
      const aetherUser = await this.aether.balanceOf.call(user);

      expect(aetherUser).to.be.bignumber.eq(new BN(value));
      expect(await balanceUser.delta()).to.be.bignumber.eq(
        ether('0')
          .sub(new BN(value))
          .sub(new BN(receipt.receipt.gasUsed))
      );
      profileGas(receipt);
    });

    it('DAI', async function() {
      const value = ether('999');
      const to = this.haave.address;
      const data = abi.simpleEncode(
        'deposit(address,uint256)',
        tokenAddress,
        value
      );

      await this.token.transfer(this.proxy.address, value, {
        from: providerAddress,
      });
      await this.proxy.updateTokenMock(this.token.address);

      const receipt = await this.proxy.execMock(
        to, 
        data, 
        { from: user}
      );
      const atokenUser = await this.atoken.balanceOf.call(user);

      expect(atokenUser).to.be.bignumber.eq(new BN(value));
      expect(await balanceUser.delta()).to.be.bignumber.eq(
        ether('0').sub(new BN(receipt.receipt.gasUsed))
      );
      profileGas(receipt);
    });

    it('revert', async function() {
      const value = ether('10');
      const to = this.haave.address;
      const data = abi.simpleEncode(
        'deposit(address,uint256)',
        '0x0000000000000000000000000000000000000000',
        value
      );
      await expectRevert.unspecified(
        this.proxy.execMock(to, data, { from: user, value: value })
      );
    });
  });

  describe('Redeem', function() {
    it('aETH', async function() {
      const value = ether('10');
      const to = this.haave.address;
      const data = abi.simpleEncode(
        'redeem(address,uint256)',
        AETHER,
        value
      );
      await this.lendingPool.deposit(
        ETH_TOKEN, 
        value, 
        0,
        { from: user, value: value }
      );

      const aetherUserBefore = await this.aether.balanceOf.call(user);
      await this.aether.transfer(this.proxy.address, value, { from: user });
      await this.proxy.updateTokenMock(this.aether.address);
      await balanceUser.get();
      
      const receipt = await this.proxy.execMock(
        to, 
        data, 
        { from: user }
      );

      const aetherUserAfter = await this.aether.balanceOf.call(user);
      const interestMax = value
        .mul(new BN(1))
        .div(new BN(10000));
      expect(aetherUserAfter).to.be.bignumber.lt(
        aetherUserBefore
          .sub(new BN(value))
          .add(new BN(interestMax))
      );
      expect(await balanceUser.delta()).to.be.bignumber.eq(
        ether('0')
          .add(new BN(value))
          .sub(new BN(receipt.receipt.gasUsed))
      );
      profileGas(receipt);
    });

    it('aDAI', async function() {
      const value = ether('999');
      const to = this.haave.address;
      const data = abi.simpleEncode(
        'redeem(address,uint256)',
        atokenAddress,
        value
      );

      await this.token.transfer(user, value, { from: providerAddress });
      await this.token.approve(this.lendingPoolCoreAddress, value, { from: user });
      await this.lendingPool.deposit(this.token.address, value, 0, { from: user });
      const atokenUserBefore = await this.atoken.balanceOf.call(user);
      const tokenUserBefore = await this.token.balanceOf.call(user);
      
      await this.atoken.transfer(this.proxy.address, value, { from: user });
      await this.proxy.updateTokenMock(this.atoken.address);
      await balanceUser.get();

      const receipt = await this.proxy.execMock(
        to, 
        data, 
        { from: user}
      );
      const atokenUserAfter = await this.atoken.balanceOf.call(user);
      const tokenUserAfter = await this.token.balanceOf.call(user);

      const interestMax = value
        .mul(new BN(1))
        .div(new BN(10000));
      expect(atokenUserAfter).to.be.bignumber.lt(
        atokenUserBefore
          .sub(new BN(value))
          .add(new BN(interestMax))
      );
      expect(tokenUserAfter).to.be.bignumber.eq(
        tokenUserBefore
          .add(new BN(value))
      );
      expect(await balanceUser.delta()).to.be.bignumber.eq(
        ether('0')
          .sub(new BN(receipt.receipt.gasUsed))
      );
      profileGas(receipt);
    });

    it('revert', async function() {
      const value = ether('10');
      const to = this.haave.address;
      const data = abi.simpleEncode(
        'redeem(address,uint256)',
        AETHER,
        value
      );
      await expectRevert.unspecified(
        this.proxy.execMock(to, data, { from: user, value: value })
      );
    });
  });

});
