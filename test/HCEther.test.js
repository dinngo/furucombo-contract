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

const { CETHER } = require('./utils/constants');
const { resetAccount, profileGas } = require('./utils/utils');

const HCEther = artifacts.require('HCEther');
const Registry = artifacts.require('Registry');
const Proxy = artifacts.require('ProxyMock');
const IToken = artifacts.require('IERC20');
const ICEther = artifacts.require('ICEther');

contract('CEther', function([_, deployer, user]) {
  let balanceUser;
  let balanceProxy;
  let cetherUser;

  before(async function() {
    this.registry = await Registry.new();
    this.proxy = await Proxy.new(this.registry.address);
    this.hcether = await HCEther.new();
    await this.registry.register(
      this.hcether.address,
      utils.asciiToHex('CEther')
    );
    this.cether = await ICEther.at(CETHER);
  });

  beforeEach(async function() {
    await resetAccount(_);
    await resetAccount(user);
    balanceUser = await tracker(user);
    balanceProxy = await tracker(this.proxy.address);
  });

  describe('Mint', function() {
    it('normal', async function() {
      const value = ether('0.1');
      const to = this.hcether.address;
      const data = abi.simpleEncode('mint(uint256)', value);
      const rate = await this.cether.exchangeRateStored.call();
      const result = value.mul(ether('1')).div(rate);
      const receipt = await this.proxy.execMock(to, data, {
        from: user,
        value: ether('0.1'),
      });
      const cetherUser = await this.cether.balanceOf.call(user);
      expect(
        cetherUser.mul(new BN('1000')).divRound(result)
      ).to.be.bignumber.eq(new BN('1000'));
      expect(await balanceUser.delta()).to.be.bignumber.eq(
        ether('0')
          .sub(ether('0.1'))
          .sub(new BN(receipt.receipt.gasUsed))
      );
      profileGas(receipt);
    });
  });

  describe('Redeem', function() {
    beforeEach(async function() {
      await this.cether.mint({
        from: user,
        value: ether('1'),
      });
      cetherUser = await this.cether.balanceOf.call(user);
    });

    it('normal', async function() {
      const value = cetherUser;
      const to = this.hcether.address;
      const data = abi.simpleEncode('redeem(uint256)', value);
      const rate = await this.cether.exchangeRateStored.call();
      const result = value.mul(rate).div(ether('1'));
      await this.cether.transfer(this.proxy.address, value, { from: user });
      await this.proxy.updateTokenMock(this.cether.address);
      await balanceUser.get();
      const receipt = await this.proxy.execMock(to, data, {
        from: user,
        value: ether('0.1'),
      });
      expect(await this.cether.balanceOf.call(user)).to.be.bignumber.eq(
        ether('0')
      );
      expect(
        (await balanceUser.delta())
          .mul(new BN('1000'))
          .divRound(result.sub(new BN(receipt.receipt.gasUsed)))
      ).to.be.bignumber.eq(new BN('1000'));
      profileGas(receipt);
    });

    it('revert', async function() {
      const value = cetherUser;
      const to = this.hcether.address;
      const data = abi.simpleEncode('redeem(uint256)', value);
      await this.proxy.updateTokenMock(this.cether.address);

      await expectRevert.unspecified(
        this.proxy.execMock(to, data, {
          from: user,
          value: ether('0.1'),
        }),
        'compound redeem failed'
      );
    });
  });

  describe('Redeem Underlying', function() {
    beforeEach(async function() {
      await this.cether.mint({
        from: user,
        value: ether('1'),
      });
      cetherUser = await this.cether.balanceOf.call(user);
    });

    it('normal', async function() {
      const value = ether('1');
      const to = this.hcether.address;
      const data = abi.simpleEncode('redeemUnderlying(uint256)', value);
      const rate = await this.cether.exchangeRateStored.call();
      const result = value.mul(ether('1')).div(rate);
      await this.cether.transfer(this.proxy.address, cetherUser, {
        from: user,
      });
      await this.proxy.updateTokenMock(this.cether.address);
      await balanceUser.get();
      const receipt = await this.proxy.execMock(to, data, {
        from: user,
        value: ether('0.1'),
      });
      expect(await balanceUser.delta()).to.be.bignumber.eq(
        value.sub(new BN(receipt.receipt.gasUsed))
      );
      expect(
        (await this.cether.balanceOf.call(user)).sub(cetherUser.sub(result))
      ).to.be.bignumber.lt(new BN('1000'));
      profileGas(receipt);
    });

    it('revert', async function() {
      const value = ether('1');
      const to = this.hcether.address;
      const data = abi.simpleEncode('redeemUnderlying(uint256)', value);
      await this.proxy.updateTokenMock(this.cether.address);
      await expectRevert.unspecified(
        this.proxy.execMock(to, data, {
          from: user,
          value: ether('0.1'),
        }),
        'compound redeem underlying failed'
      );
    });
  });
});
