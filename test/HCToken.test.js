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
const { MAX_UINT256 } = constants;
const { latest } = time;
const abi = require('ethereumjs-abi');
const utils = web3.utils;

const { expect } = require('chai');

const {
  CDAI,
  CETHER,
  DAI_TOKEN,
  DAI_PROVIDER,
  COMPOUND_COMPTROLLER,
} = require('./utils/constants');
const { evmRevert, evmSnapshot, profileGas } = require('./utils/utils');

const HCToken = artifacts.require('HCToken');
const Registry = artifacts.require('Registry');
const Proxy = artifacts.require('ProxyMock');
const IToken = artifacts.require('IERC20');
const ICEther = artifacts.require('ICEther');
const ICToken = artifacts.require('ICToken');
const IComptroller = artifacts.require('IComptroller');

contract('CToken', function([_, user]) {
  let id;
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
    id = await evmSnapshot();
    balanceUser = await tracker(user);
    balanceProxy = await tracker(this.proxy.address);
  });

  afterEach(async function() {
    await evmRevert(id);
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
      profileGas(receipt);
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
        this.proxy.execMock(to, data, { from: user }),
        'compound mint failed'
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
      profileGas(receipt);
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
        }),
        'compound redeem failed'
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
      profileGas(receipt);
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
        }),
        'compound redeem underlying failed'
      );
    });
  });

  describe('Repay Borrow Behalf', function() {
    before(async function() {
      this.comptroller = await IComptroller.at(COMPOUND_COMPTROLLER);
      this.cether = await await ICEther.at(CETHER);
      await this.comptroller.enterMarkets([CETHER], { from: user });
    });
    beforeEach(async function() {
      await this.cether.mint({ from: user, value: ether('1') });
      await this.ctoken.borrow(ether('1'), { from: user });
    });

    it('normal', async function() {
      const value = MAX_UINT256;
      const to = this.hctoken.address;
      const data = abi.simpleEncode(
        'repayBorrowBehalf(address,address,uint256)',
        this.ctoken.address,
        user,
        value
      );
      await this.token.transfer(this.proxy.address, ether('10'), {
        from: providerAddress,
      });
      await this.proxy.updateTokenMock(this.token.address);
      const receipt = await this.proxy.execMock(to, data, {
        from: user,
        value: ether('0.1'),
      });
      expect(
        await this.ctoken.borrowBalanceCurrent.call(user)
      ).to.be.bignumber.eq(ether('0'));
    });

    it('insufficient token', async function() {
      const value = MAX_UINT256;
      const to = this.hctoken.address;
      const data = abi.simpleEncode(
        'repayBorrowBehalf(address,address,uint256)',
        this.ctoken.address,
        user,
        value
      );
      await this.token.transfer(this.proxy.address, ether('0.8'), {
        from: providerAddress,
      });
      await this.proxy.updateTokenMock(this.token.address);
      await expectRevert.unspecified(
        this.proxy.execMock(to, data, {
          from: user,
          value: ether('0.1'),
        })
      );
    });
  });
});
