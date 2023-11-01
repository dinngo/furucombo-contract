const chainId = network.config.chainId;
if (chainId == 42161) {
  // This test supports to run on these chains.
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
  USDC_TOKEN,
  RUSDC_TOKEN,
  RADIANT_PROVIDER,
  AAVE_RATEMODE,
  WRAPPED_NATIVE_TOKEN,
  RWRAPPED_NATIVE_DEBT_VARIABLE,
} = require('./utils/constants');
const {
  evmRevert,
  evmSnapshot,
  profileGas,
  getHandlerReturn,
  getTokenProvider,
  expectEqWithinBps,
  mwei,
} = require('./utils/utils');

const HRadiant = artifacts.require('HRadiant');
const FeeRuleRegistry = artifacts.require('FeeRuleRegistry');
const Registry = artifacts.require('Registry');
const Proxy = artifacts.require('ProxyMock');
const IToken = artifacts.require('IERC20');
const IAToken = artifacts.require('IATokenV2');
const ILendingPool = artifacts.require('ILendingPoolV2');
const IProvider = artifacts.require('ILendingPoolAddressesProviderV2');
const SimpleToken = artifacts.require('SimpleToken');

contract('Radiant Repay', function ([_, user]) {
  const aTokenAddress = RUSDC_TOKEN;
  const tokenAddress = USDC_TOKEN;

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
    this.hRadiant = await HRadiant.new(WRAPPED_NATIVE_TOKEN, RADIANT_PROVIDER);
    await this.registry.register(
      this.hRadiant.address,
      utils.asciiToHex('Radiant')
    );
    this.provider = await IProvider.at(RADIANT_PROVIDER);
    this.lendingPoolAddress = await this.provider.getLendingPool.call();
    this.lendingPool = await ILendingPool.at(this.lendingPoolAddress);
    this.token = await IToken.at(tokenAddress);
    this.aToken = await IAToken.at(aTokenAddress);
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
    var depositAmount = mwei('1000');
    const borrowAmount = mwei('0.1');
    const borrowTokenAddr = WRAPPED_NATIVE_TOKEN;
    const rateMode = AAVE_RATEMODE.VARIABLE;
    const debtTokenAddr = RWRAPPED_NATIVE_DEBT_VARIABLE;

    let borrowTokenProvider;

    before(async function () {
      borrowTokenProvider = await getTokenProvider(borrowTokenAddr);

      this.borrowToken = await IToken.at(borrowTokenAddr);
      this.debtToken = await IToken.at(debtTokenAddr);
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
      depositAmount = await this.aToken.balanceOf.call(user);

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
      const to = this.hRadiant.address;
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
      const to = this.hRadiant.address;
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
      const extraNeed = mwei('1');
      const value = borrowAmount.add(extraNeed);
      const to = this.hRadiant.address;
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
      const extraNeed = mwei('1');
      const value = borrowAmount.add(extraNeed);
      const to = this.hRadiant.address;
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
      const value = mwei('0.05');
      const to = this.hRadiant.address;
      const data = abi.simpleEncode(
        'repay(address,uint256,uint256,address)',
        this.borrowToken.address,
        value,
        rateMode,
        user
      );
      await this.borrowToken.transfer(
        this.proxy.address,
        value.sub(ether('0.01')),
        { from: user }
      );
      await this.proxy.updateTokenMock(this.borrowToken.address);
      await expectRevert(
        this.proxy.execMock(to, data, { from: user }),
        'HRadiant_repay: ERC20: transfer amount exceeds balance'
      );
    });

    it('should revert: unsupported token', async function () {
      const value = mwei('0.5');
      const to = this.hRadiant.address;
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
        'HRadiant_repay: Unspecified'
      );
    });

    it('should revert: wrong rate mode', async function () {
      const value = mwei('0.05');
      const to = this.hRadiant.address;
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
        'HRadiant_repay: 15'
      );
    });
  });
});
