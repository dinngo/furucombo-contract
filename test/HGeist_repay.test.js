const chainId = network.config.chainId;
if (chainId == 250) {
  // This test supports to run on these chains.
  return; // skipped because Geist is paused
} else {
  return;
}

const {
  balance,
  BN,
  ether,
  expectRevert,
} = require('@openzeppelin/test-helpers');
const { tracker } = balance;
const abi = require('ethereumjs-abi');
const utils = web3.utils;

const { expect } = require('chai');

const {
  DAI_TOKEN,
  GEIST_LENDING_POOL_PROVIDER,
  AAVE_RATEMODE,
  WRAPPED_NATIVE_TOKEN,
} = require('./utils/constants');
const {
  evmRevert,
  evmSnapshot,
  profileGas,
  getHandlerReturn,
  getTokenProvider,
  expectEqWithinBps,
} = require('./utils/utils');

const HGeist = artifacts.require('HGeist');
const FeeRuleRegistry = artifacts.require('FeeRuleRegistry');
const Registry = artifacts.require('Registry');
const Proxy = artifacts.require('ProxyMock');
const IToken = artifacts.require('IERC20');
const IAToken = artifacts.require('IATokenV2');
const ILendingPool = artifacts.require('ILendingPoolV2');
const IProvider = artifacts.require('ILendingPoolAddressesProviderV2');
const SimpleToken = artifacts.require('SimpleToken');

contract('Geist', function ([_, user]) {
  const tokenAddress = DAI_TOKEN;

  let id;
  let balanceUser;
  let providerAddress;

  before(async function () {
    providerAddress = await getTokenProvider(tokenAddress);

    this.registry = await Registry.new();
    this.feeRuleRegistry = await FeeRuleRegistry.new('0', _);
    this.proxy = await Proxy.new(
      this.registry.address,
      this.feeRuleRegistry.address
    );
    this.hGeist = await HGeist.new(
      WRAPPED_NATIVE_TOKEN,
      GEIST_LENDING_POOL_PROVIDER,
      0
    );
    await this.registry.register(
      this.hGeist.address,
      utils.asciiToHex('Geist')
    );
    this.provider = await IProvider.at(GEIST_LENDING_POOL_PROVIDER);
    this.lendingPoolAddress = await this.provider.getLendingPool.call();
    this.lendingPool = await ILendingPool.at(this.lendingPoolAddress);
    this.token = await IToken.at(tokenAddress);
    this.gToken = await IAToken.at(
      (
        await this.lendingPool.getReserveData.call(tokenAddress)
      ).aTokenAddress
    );
    this.mockToken = await SimpleToken.new();
  });

  beforeEach(async function () {
    id = await evmSnapshot();
    balanceUser = await tracker(user);
    balanceProxy = await tracker(this.proxy.address);
  });

  afterEach(async function () {
    await evmRevert(id);
  });

  describe('Repay Variable Rate', function () {
    var depositAmount = ether('10000');
    const borrowAmount = ether('1');
    const borrowTokenAddr = WRAPPED_NATIVE_TOKEN;
    const rateMode = AAVE_RATEMODE.VARIABLE;

    let borrowTokenProvider;
    before(async function () {
      borrowTokenProvider = await getTokenProvider(borrowTokenAddr);

      this.borrowToken = await IToken.at(borrowTokenAddr);
      this.debtToken = await IToken.at(
        (
          await this.lendingPool.getReserveData.call(borrowTokenAddr)
        ).variableDebtTokenAddress
      );
    });

    beforeEach(async function () {
      // Deposit
      await this.token.approve(this.lendingPool.address, depositAmount, {
        from: providerAddress,
      });
      await this.lendingPool.deposit(
        this.token.address,
        depositAmount,
        user,
        0,
        { from: providerAddress }
      );
      depositAmount = await this.gToken.balanceOf.call(user);

      // Borrow
      await this.lendingPool.borrow(
        this.borrowToken.address,
        borrowAmount,
        rateMode,
        0,
        user,
        { from: user }
      );

      expect(await this.borrowToken.balanceOf.call(user)).to.be.bignumber.eq(
        borrowAmount
      );
      expectEqWithinBps(
        await this.debtToken.balanceOf.call(user),
        borrowAmount
      );
    });

    it('partial', async function () {
      const value = borrowAmount.div(new BN('2'));
      const to = this.hGeist.address;
      const data = abi.simpleEncode(
        'repay(address,uint256,uint256,address)',
        this.borrowToken.address,
        value,
        rateMode,
        user
      );
      await this.borrowToken.transfer(this.proxy.address, value, {
        from: user,
      });
      await this.proxy.updateTokenMock(this.borrowToken.address);
      await balanceUser.get();

      const debtTokenUserBefore = await this.debtToken.balanceOf.call(user);
      const receipt = await this.proxy.execMock(to, data, {
        from: user,
        value: ether('0.1'),
      });

      // Get handler return result
      const handlerReturn = utils.toBN(
        getHandlerReturn(receipt, ['uint256'])[0]
      );
      const borrowTokenUserAfter = await this.borrowToken.balanceOf.call(user);
      const debtTokenUserAfter = await this.debtToken.balanceOf.call(user);
      const interestMax = borrowAmount.mul(new BN(1)).div(new BN(10000));

      // Verify handler return
      // (borrowAmount - repayAmount -1) <= remainBorrowAmount < (borrowAmount + interestMax - repayAmount)
      // NOTE: handlerReturn == (borrowAmount - repayAmount -1) (sometime, Ganache bug maybe)
      expect(handlerReturn).to.be.bignumber.gte(
        borrowAmount.sub(value.add(new BN(1)))
      );
      expect(handlerReturn).to.be.bignumber.lt(
        borrowAmount.sub(value).add(interestMax)
      );
      // Verify proxy balance
      expect(
        await this.borrowToken.balanceOf.call(this.proxy.address)
      ).to.be.bignumber.zero;
      // Verify user balance
      // (borrow - repay - 1) <= debtTokenUserAfter < (borrow + interestMax - repay)
      expect(debtTokenUserAfter).to.be.bignumber.gte(
        borrowAmount.sub(value).sub(new BN(1))
      );
      expect(debtTokenUserAfter).to.be.bignumber.lt(
        borrowAmount.add(interestMax).sub(value)
      );
      expect(borrowTokenUserAfter).to.be.bignumber.eq(borrowAmount.sub(value));
      expect(await balanceUser.delta()).to.be.bignumber.eq(ether('0'));
      profileGas(receipt);
    });

    it('partial by ETH', async function () {
      const value = borrowAmount.div(new BN('2'));
      const to = this.hGeist.address;
      const data = abi.simpleEncode(
        'repayETH(uint256,uint256,address)',
        value,
        rateMode,
        user
      );
      await balanceUser.get();
      const debtTokenUserBefore = await this.debtToken.balanceOf.call(user);
      const receipt = await this.proxy.execMock(to, data, {
        from: user,
        value: value,
      });

      // Get handler return result
      const handlerReturn = utils.toBN(
        getHandlerReturn(receipt, ['uint256'])[0]
      );
      const debtTokenUserAfter = await this.debtToken.balanceOf.call(user);
      const interestMax = borrowAmount.mul(new BN(1)).div(new BN(10000));

      // Verify handler return
      // (borrowAmount - repayAmount -1) <= remainBorrowAmount < (borrowAmount + interestMax - repayAmount)
      // NOTE: handlerReturn == (borrowAmount - repayAmount -1) (sometime, Ganache bug maybe)
      expect(handlerReturn).to.be.bignumber.gte(
        borrowAmount.sub(value.add(new BN(1)))
      );
      expect(handlerReturn).to.be.bignumber.lt(
        borrowAmount.sub(value).add(interestMax)
      );
      // Verify proxy balance
      expect(
        await this.borrowToken.balanceOf.call(this.proxy.address)
      ).to.be.bignumber.zero;
      // Verify user balance
      // (borrow - repay - 1) <= debtTokenUserAfter < (borrow + interestMax - repay)
      expect(debtTokenUserAfter).to.be.bignumber.gte(
        borrowAmount.sub(value).sub(new BN(1))
      );
      expect(debtTokenUserAfter).to.be.bignumber.lt(
        borrowAmount.add(interestMax).sub(value)
      );
      expect(await balanceUser.delta()).to.be.bignumber.eq(
        ether('0').sub(value)
      );
      profileGas(receipt);
    });

    it('whole', async function () {
      const extraNeed = ether('1');
      const value = borrowAmount.add(extraNeed);
      const to = this.hGeist.address;
      const data = abi.simpleEncode(
        'repay(address,uint256,uint256,address)',
        this.borrowToken.address,
        value,
        rateMode,
        user
      );
      await this.borrowToken.transfer(user, extraNeed, {
        from: borrowTokenProvider,
      });
      await this.borrowToken.transfer(this.proxy.address, value, {
        from: user,
      });
      await this.proxy.updateTokenMock(this.borrowToken.address);
      await balanceUser.get();

      const receipt = await this.proxy.execMock(to, data, {
        from: user,
        value: ether('0.1'),
      });

      // Get handler return result
      const handlerReturn = utils.toBN(
        getHandlerReturn(receipt, ['uint256'])[0]
      );
      const borrowTokenUserAfter = await this.borrowToken.balanceOf.call(user);
      const debtTokenUserAfter = await this.debtToken.balanceOf.call(user);
      const interestMax = borrowAmount.mul(new BN(1)).div(new BN(10000));

      // Verify handler return
      expect(handlerReturn).to.be.bignumber.zero;
      // Verify proxy balance
      expect(
        await this.borrowToken.balanceOf.call(this.proxy.address)
      ).to.be.bignumber.zero;
      // Verify user balance
      expect(debtTokenUserAfter).to.be.bignumber.zero;
      // (repay - borrow - interestMax) < borrowTokenUserAfter <= (repay - borrow)
      expect(borrowTokenUserAfter).to.be.bignumber.lte(value.sub(borrowAmount));
      expect(borrowTokenUserAfter).to.be.bignumber.gt(
        value.sub(borrowAmount).sub(interestMax)
      );
      expect(await balanceUser.delta()).to.be.bignumber.eq(ether('0'));
      profileGas(receipt);
    });

    it('whole by ETH', async function () {
      const extraNeed = ether('1');
      const value = borrowAmount.add(extraNeed);
      const to = this.hGeist.address;
      const data = abi.simpleEncode(
        'repayETH(uint256,uint256,address)',
        value,
        rateMode,
        user
      );
      await balanceUser.get();

      const receipt = await this.proxy.execMock(to, data, {
        from: user,
        value: value,
      });

      // Get handler return result
      const handlerReturn = utils.toBN(
        getHandlerReturn(receipt, ['uint256'])[0]
      );
      const debtTokenUserAfter = await this.debtToken.balanceOf.call(user);
      const interestMax = borrowAmount.mul(new BN(1)).div(new BN(10000));

      // Verify handler return
      expect(handlerReturn).to.be.bignumber.zero;
      // Verify proxy balance
      expect(
        await this.borrowToken.balanceOf.call(this.proxy.address)
      ).to.be.bignumber.zero;
      // Verify user balance
      expect(debtTokenUserAfter).to.be.bignumber.zero;
      // (repay - borrow - interestMax) < borrowTokenUserAfter <= (repay - borrow)
      expect(await balanceUser.delta()).to.be.bignumber.lte(
        ether('0').sub(borrowAmount)
      );
      expect(await balanceUser.delta()).to.be.bignumber.gt(
        ether('0').sub(borrowAmount).sub(interestMax)
      );
      profileGas(receipt);
    });

    it('should revert: not enough balance', async function () {
      const value = ether('0.5');
      const to = this.hGeist.address;
      const data = abi.simpleEncode(
        'repay(address,uint256,uint256,address)',
        this.borrowToken.address,
        value,
        rateMode,
        user
      );
      await this.borrowToken.transfer(
        this.proxy.address,
        value.sub(ether('0.1')),
        { from: user }
      );
      await this.proxy.updateTokenMock(this.borrowToken.address);
      await expectRevert(
        this.proxy.execMock(to, data, { from: user }),
        'HGeist_repay: SafeERC20: low-level call failed'
      );
    });

    it('should revert: unsupported token', async function () {
      const value = ether('0.5');
      const to = this.hGeist.address;
      const data = abi.simpleEncode(
        'repay(address,uint256,uint256,address)',
        this.mockToken.address,
        value,
        rateMode,
        user
      );
      await this.mockToken.transfer(this.proxy.address, value, { from: _ });
      await this.proxy.updateTokenMock(this.mockToken.address);
      await expectRevert(
        this.proxy.execMock(to, data, { from: user }),
        'HGeist_repay: Unspecified'
      );
    });

    it('should revert: wrong rate mode', async function () {
      const value = ether('0.5');
      const to = this.hGeist.address;
      const unborrowedRateMode = (rateMode % 2) + 1;
      const data = abi.simpleEncode(
        'repay(address,uint256,uint256,address)',
        this.borrowToken.address,
        value,
        unborrowedRateMode,
        user
      );
      await this.borrowToken.transfer(this.proxy.address, value, {
        from: user,
      });
      await this.proxy.updateTokenMock(this.borrowToken.address);
      await expectRevert(
        this.proxy.execMock(to, data, { from: user }),
        'HGeist_repay: 15'
      );
    });
  });
});
