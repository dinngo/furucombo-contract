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

const { CDAI, DAI_TOKEN, DAI_PROVIDER } = require('./utils/constants');
const { resetAccount } = require('./utils/utils');

const HCToken = artifacts.require('HCToken');
const Registry = artifacts.require('Registry');
const Proxy = artifacts.require('ProxyMock');
const IToken = artifacts.require('IERC20');
const ICToken = artifacts.require('ICToken');

contract('CToken', function([_, deployer, user]) {
  const ctokenAddress = CDAI;
  const tokenAddress = DAI_TOKEN;
  const providerAddress = DAI_PROVIDER;

  let balanceUser;
  let balanceProxy;
  let tokenUser;
  let ctokenUser;

  before(async function() {
    this.registry = await Registry.new();
    this.proxy = await Proxy.new(this.registry.address);
    this.hctoken = await HCToken.new();
    await this.registry.register(
      this.hctoken.address,
      utils.asciiToHex('CToken')
    );
    this.token = await IToken.at(tokenAddress);
    this.ctoken = await ICToken.at(ctokenAddress);
  });

  beforeEach(async function() {
    await resetAccount(_);
    await resetAccount(user);
    balanceUser = await tracker(user);
    balanceProxy = await tracker(this.proxy.address);
  });

  describe('Mint', function() {
    it('normal', async function() {
      const value = ether('10');
      const to = this.hctoken.address;
      const data = abi.simpleEncode(
        'mint(address,uint256)',
        ctokenAddress,
        value
      );
      await this.token.transfer(this.proxy.address, value, {
        from: providerAddress,
      });
      await this.proxy.updateTokenMock(this.token.address);

      const rate = await this.ctoken.exchangeRateStored.call();
      const result = value.mul(ether('1')).div(rate);
      const receipt = await this.proxy.execMock(to, data, { from: user });
      ctokenUser = await this.ctoken.balanceOf.call(user);
      expect(
        ctokenUser.mul(new BN('1000')).divRound(result)
      ).to.be.bignumber.eq(new BN('1000'));
      expect(await balanceUser.delta()).to.be.bignumber.eq(
        ether('0').sub(new BN(receipt.receipt.gasUsed))
      );
    });

    it('revert', async function() {
      const value = ether('10');
      const to = this.hctoken.address;
      const data = abi.simpleEncode(
        'mint(address,uint256)',
        ctokenAddress,
        value
      );
      await this.proxy.updateTokenMock(this.token.address);
      await expectRevert.unspecified(
        this.proxy.execMock(to, data, { from: user })
      );
    });
  });

  describe('Redeem', function() {
    beforeEach(async function() {
      await this.token.transfer(user, ether('1'), { from: providerAddress });
      await this.token.approve(this.ctoken.address, ether('1'), { from: user });
      await this.ctoken.mint(ether('1'), { from: user });
      tokenUser = await this.token.balanceOf.call(user);
      ctokenUser = await this.ctoken.balanceOf.call(user);
    });

    it('normal', async function() {
      const value = ctokenUser;
      const to = this.hctoken.address;
      const data = abi.simpleEncode(
        'redeem(address,uint256)',
        this.ctoken.address,
        value
      );
      const rate = await this.ctoken.exchangeRateStored.call();
      const result = value.mul(rate).div(ether('1'));
      await this.ctoken.transfer(this.proxy.address, value, { from: user });
      await this.proxy.updateTokenMock(this.ctoken.address);
      ctokenUser = await this.ctoken.balanceOf.call(user);
      const receipt = await this.proxy.execMock(to, data, {
        from: user,
        value: ether('0.1'),
      });
      expect(await this.ctoken.balanceOf.call(user)).to.be.bignumber.eq(
        ether('0')
      );
      expect(
        (await this.token.balanceOf.call(user))
          .sub(tokenUser)
          .mul(new BN('1000'))
          .divRound(result)
      ).to.be.bignumber.eq(new BN('1000'));
    });

    it('revert', async function() {
      const value = ctokenUser;
      const to = this.hctoken.address;
      const data = abi.simpleEncode(
        'redeem(address,uint256)',
        this.ctoken.address,
        value
      );
      await this.proxy.updateTokenMock(this.ctoken.address);
      await expectRevert.unspecified(
        this.proxy.execMock(to, data, {
          from: user,
          value: ether('0.1'),
        })
      );
    });
  });

  describe('Redeem Underlying', function() {
    beforeEach(async function() {
      await this.token.transfer(user, ether('100'), { from: providerAddress });
      await this.token.approve(this.ctoken.address, ether('100'), {
        from: user,
      });
      await this.ctoken.mint(ether('100'), { from: user });
      tokenUser = await this.token.balanceOf.call(user);
      ctokenUser = await this.ctoken.balanceOf.call(user);
    });

    it('normal', async function() {
      const value = ether('100');
      const to = this.hctoken.address;
      const data = abi.simpleEncode(
        'redeemUnderlying(address,uint256)',
        this.ctoken.address,
        value
      );
      const rate = await this.ctoken.exchangeRateStored.call();
      const result = value.mul(ether('1')).div(rate);
      await this.ctoken.transfer(this.proxy.address, ctokenUser, {
        from: user,
      });
      await this.proxy.updateTokenMock(this.ctoken.address);
      ctokenUser = await this.ctoken.balanceOf.call(user);
      const receipt = await this.proxy.execMock(to, data, {
        from: user,
        value: ether('0.1'),
      });
      expect(
        (await this.token.balanceOf.call(user)).sub(tokenUser)
      ).to.be.bignumber.eq(value);
      /* Fix this
      expect(
        (await this.ctoken.balanceOf.call(user)).sub(ctokenUser.sub(result))
      ).to.be.bignumber.lt(new BN('1000'));
      */
    });

    it('revert', async function() {
      const value = ether('100');
      const to = this.hctoken.address;
      const data = abi.simpleEncode(
        'redeemUnderlying(address,uint256)',
        this.ctoken.address,
        value
      );
      await this.proxy.updateTokenMock(this.ctoken.address);

      // ctokenUser = await this.ctoken.balanceOf.call(user);
      await expectRevert.unspecified(
        this.proxy.execMock(to, data, {
          from: user,
          value: ether('0.1'),
        })
      );
    });
  });
});
