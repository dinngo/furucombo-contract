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
  RecordHandlerResultSig,
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
  const cTokenAddress = CDAI;
  const tokenAddress = DAI_TOKEN;
  const providerAddress = DAI_PROVIDER;

  let balanceUser;
  let balanceProxy;
  let tokenUser;
  let cTokenUser;

  before(async function() {
    this.registry = await Registry.new();
    this.proxy = await Proxy.new(this.registry.address);
    this.hCToken = await HCToken.new();
    await this.registry.register(
      this.hCToken.address,
      utils.asciiToHex('CToken')
    );
    this.token = await IToken.at(tokenAddress);
    this.cToken = await ICToken.at(cTokenAddress);
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
      const to = this.hCToken.address;
      const data = abi.simpleEncode(
        'mint(address,uint256)',
        cTokenAddress,
        value
      );
      await this.token.transfer(this.proxy.address, value, {
        from: providerAddress,
      });
      await this.proxy.updateTokenMock(this.token.address);
      cTokenUser = await this.cToken.balanceOf.call(user);

      const rate = await this.cToken.exchangeRateStored.call();
      const result = value.mul(ether('1')).div(rate);
      const receipt = await this.proxy.execMock(to, data, { from: user });

      // Get handler return result
      var handlerResult;
      receipt.receipt.rawLogs.forEach(element => {
        if (element.topics[0] === RecordHandlerResultSig) {
          // handler return result start from the third args
          handlerResult = utils.toBN(
            web3.eth.abi.decodeParameters(
              ['uint256', 'uint256', 'uint256'],
              element.data
            )[2]
          );
        }
      });

      cTokenUserEnd = await this.cToken.balanceOf.call(user);
      expect(cTokenUserEnd.sub(cTokenUser)).to.be.bignumber.eq(handlerResult);
      expect(
        cTokenUserEnd.mul(new BN('1000')).divRound(result)
      ).to.be.bignumber.eq(new BN('1000'));
      expect(await balanceUser.delta()).to.be.bignumber.eq(
        ether('0').sub(new BN(receipt.receipt.gasUsed))
      );
      profileGas(receipt);
    });

    it('revert', async function() {
      const value = ether('10');
      const to = this.hCToken.address;
      const data = abi.simpleEncode(
        'mint(address,uint256)',
        cTokenAddress,
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
      await this.token.approve(this.cToken.address, ether('1'), { from: user });
      await this.cToken.mint(ether('1'), { from: user });
      tokenUser = await this.token.balanceOf.call(user);
      cTokenUser = await this.cToken.balanceOf.call(user);
    });

    it('normal', async function() {
      const value = cTokenUser;
      const to = this.hCToken.address;
      const data = abi.simpleEncode(
        'redeem(address,uint256)',
        this.cToken.address,
        value
      );
      const rate = await this.cToken.exchangeRateStored.call();
      const result = value.mul(rate).div(ether('1'));
      await this.cToken.transfer(this.proxy.address, value, { from: user });
      await this.proxy.updateTokenMock(this.cToken.address);
      tokenUser = await this.token.balanceOf.call(user);
      cTokenUser = await this.cToken.balanceOf.call(user);
      const receipt = await this.proxy.execMock(to, data, {
        from: user,
        value: ether('0.1'),
      });

      // Get handler return result
      var handlerResult;
      receipt.receipt.rawLogs.forEach(element => {
        if (element.topics[0] === RecordHandlerResultSig) {
          // handler return result start from the third args
          handlerResult = utils.toBN(
            web3.eth.abi.decodeParameters(
              ['uint256', 'uint256', 'uint256'],
              element.data
            )[2]
          );
        }
      });

      tokenUserEnd = await this.token.balanceOf.call(user);
      expect(tokenUserEnd.sub(tokenUser)).to.be.bignumber.eq(handlerResult);

      expect(await this.cToken.balanceOf.call(user)).to.be.bignumber.eq(
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
      const value = cTokenUser;
      const to = this.hCToken.address;
      const data = abi.simpleEncode(
        'redeem(address,uint256)',
        this.cToken.address,
        value
      );
      await this.proxy.updateTokenMock(this.cToken.address);
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
      await this.token.approve(this.cToken.address, ether('100'), {
        from: user,
      });
      await this.cToken.mint(ether('100'), { from: user });
      tokenUser = await this.token.balanceOf.call(user);
      cTokenUser = await this.cToken.balanceOf.call(user);
    });

    it('normal', async function() {
      const value = ether('100');
      const to = this.hCToken.address;
      const data = abi.simpleEncode(
        'redeemUnderlying(address,uint256)',
        this.cToken.address,
        value
      );
      const rate = await this.cToken.exchangeRateStored.call();
      const result = value.mul(ether('1')).div(rate);
      await this.cToken.transfer(this.proxy.address, cTokenUser, {
        from: user,
      });
      await this.proxy.updateTokenMock(this.cToken.address);
      const receipt = await this.proxy.execMock(to, data, {
        from: user,
        value: ether('0.1'),
      });

      // Get handler return result
      var handlerResult;
      receipt.receipt.rawLogs.forEach(element => {
        if (element.topics[0] === RecordHandlerResultSig) {
          // handler return result start from the third args
          handlerResult = utils.toBN(
            web3.eth.abi.decodeParameters(
              ['uint256', 'uint256', 'uint256'],
              element.data
            )[2]
          );
        }
      });
      const cTokenUserEnd = await this.cToken.balanceOf.call(user);
      expect(handlerResult).to.be.bignumber.eq(cTokenUser.sub(cTokenUserEnd));

      expect(
        (await this.token.balanceOf.call(user)).sub(tokenUser)
      ).to.be.bignumber.eq(value);
      /* Fix this
      expect(
        (await this.cToken.balanceOf.call(user)).sub(cTokenUser.sub(result))
      ).to.be.bignumber.lt(new BN('1000'));
      */
      profileGas(receipt);
    });

    it('revert', async function() {
      const value = ether('100');
      const to = this.hCToken.address;
      const data = abi.simpleEncode(
        'redeemUnderlying(address,uint256)',
        this.cToken.address,
        value
      );
      await this.proxy.updateTokenMock(this.cToken.address);
      // cTokenUser = await this.cToken.balanceOf.call(user);
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
      await this.cToken.borrow(ether('1'), { from: user });
    });

    it('normal', async function() {
      const value = MAX_UINT256;
      const to = this.hCToken.address;
      const data = abi.simpleEncode(
        'repayBorrowBehalf(address,address,uint256)',
        this.cToken.address,
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
      // Get handler return result
      var handlerResult;
      receipt.receipt.rawLogs.forEach(element => {
        if (element.topics[0] === RecordHandlerResultSig) {
          // handler return result start from the third args
          handlerResult = utils.toBN(
            web3.eth.abi.decodeParameters(
              ['uint256', 'uint256', 'uint256'],
              element.data
            )[2]
          );
        }
      });

      expect(
        await this.cToken.borrowBalanceCurrent.call(user)
      ).to.be.bignumber.eq(handlerResult);

      expect(
        await this.cToken.borrowBalanceCurrent.call(user)
      ).to.be.bignumber.eq(ether('0'));
    });

    it('insufficient token', async function() {
      const value = MAX_UINT256;
      const to = this.hCToken.address;
      const data = abi.simpleEncode(
        'repayBorrowBehalf(address,address,uint256)',
        this.cToken.address,
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
