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
  DAI_TOKEN,
  USDT_TOKEN,
  COMP_TOKEN,
  RDAI_TOKEN,
  AAVE_RATEMODE,
  RADIAN_PROVIDER,
  WRAPPED_NATIVE_TOKEN,
  RUSDT_DEBT_VARIABLE,
  RWRAPPED_NATIVE_DEBT_VARIABLE,
} = require('./utils/constants');
const {
  evmRevert,
  evmSnapshot,
  profileGas,
  expectEqWithinBps,
  getTokenProvider,
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
const IVariableDebtToken = artifacts.require('IVariableDebtToken');

contract('Radiant', function ([_, user, someone]) {
  const aTokenAddress = RDAI_TOKEN;
  const tokenAddress = DAI_TOKEN;

  let id;
  let balanceUser;
  let balanceProxy;
  let providerAddress;

  before(async function () {
    providerAddress = await getTokenProvider(tokenAddress);
    this.registry = await Registry.new();
    this.feeRuleRegistry = await FeeRuleRegistry.new('0', _);
    this.proxy = await Proxy.new(
      this.registry.address,
      this.feeRuleRegistry.address
    );
    this.hRadiant = await HRadiant.new(WRAPPED_NATIVE_TOKEN, RADIAN_PROVIDER);
    await this.registry.register(
      this.hRadiant.address,
      utils.asciiToHex('Radiant')
    );
    this.provider = await IProvider.at(RADIAN_PROVIDER);
    this.lendingPoolAddress = await this.provider.getLendingPool.call();
    this.lendingPool = await ILendingPool.at(this.lendingPoolAddress);
    this.token = await IToken.at(tokenAddress);
    this.aToken = await IAToken.at(aTokenAddress);
  });

  beforeEach(async function () {
    id = await evmSnapshot();
    balanceUser = await tracker(user);
    balanceProxy = await tracker(this.proxy.address);
  });

  afterEach(async function () {
    await evmRevert(id);
  });

  // Radiant not support stable brorrow
  describe('Borrow with Variable Rate', function () {
    const depositAmount = ether('10000');
    const borrowTokenAddr = USDT_TOKEN;
    const rateMode = AAVE_RATEMODE.VARIABLE;
    const debtTokenAddr = RUSDT_DEBT_VARIABLE;
    const debtWrappedNativeTokenAddr = RWRAPPED_NATIVE_DEBT_VARIABLE;

    let borrowTokenUserBefore;
    let debtTokenUserBefore;
    let debtWrappedNativeTokenUserBefore;

    before(async function () {
      this.borrowToken = await IToken.at(borrowTokenAddr);
      this.wrappedNativeToken = await IToken.at(WRAPPED_NATIVE_TOKEN);
      this.debtWrappedNativeToken = await IVariableDebtToken.at(
        debtWrappedNativeTokenAddr
      );
      this.debtToken = await IVariableDebtToken.at(debtTokenAddr);
    });

    beforeEach(async function () {
      // Deposit
      await this.token.approve(this.lendingPool.address, depositAmount, {
        from: providerAddress,
      });

      expect(await this.aToken.balanceOf.call(user)).to.be.bignumber.zero;
      await this.lendingPool.deposit(
        this.token.address,
        depositAmount,
        user,
        0,
        { from: providerAddress }
      );
      expectEqWithinBps(await this.aToken.balanceOf.call(user), depositAmount);

      borrowTokenUserBefore = await this.borrowToken.balanceOf.call(user);
      borrowWrappedNativeTokenUserBefore =
        await this.wrappedNativeToken.balanceOf.call(user);
      debtTokenUserBefore = await this.debtToken.balanceOf.call(user);
      debtWrappedNativeTokenUserBefore =
        await this.debtWrappedNativeToken.balanceOf.call(user);
    });

    it('borrow token', async function () {
      const borrowAmount = mwei('100');
      const to = this.hRadiant.address;
      const data = abi.simpleEncode(
        'borrow(address,uint256,uint256)',
        this.borrowToken.address,
        borrowAmount,
        rateMode
      );
      await this.debtToken.approveDelegation(this.proxy.address, borrowAmount, {
        from: user,
      });
      await balanceUser.get();
      const receipt = await this.proxy.execMock(to, data, {
        from: user,
        value: ether('0.1'),
      });
      const borrowTokenUserAfter = await this.borrowToken.balanceOf.call(user);
      const debtTokenUserAfter = await this.debtToken.balanceOf.call(user);
      // Verify proxy balance
      expect(await balanceProxy.get()).to.be.bignumber.zero;
      expect(
        await this.borrowToken.balanceOf.call(this.proxy.address)
      ).to.be.bignumber.zero;
      expect(
        await this.debtToken.balanceOf.call(this.proxy.address)
      ).to.be.bignumber.zero;

      // Verify user balance
      expect(
        borrowTokenUserAfter.sub(borrowTokenUserBefore)
      ).to.be.bignumber.eq(borrowAmount);

      //  borrowAmount <= (debtTokenUserAfter-debtTokenUserBefore) < borrowAmount + interestMax
      const interestMax = borrowAmount.mul(new BN(1)).div(new BN(10000));
      expectEqWithinBps(
        debtTokenUserAfter.sub(debtTokenUserBefore),
        borrowAmount
      );
      expect(debtTokenUserAfter.sub(debtTokenUserBefore)).to.be.bignumber.lt(
        borrowAmount.add(interestMax)
      );

      profileGas(receipt);
    });

    it('borrow weth', async function () {
      const borrowAmount = ether('1');
      const to = this.hRadiant.address;
      const data = abi.simpleEncode(
        'borrow(address,uint256,uint256)',
        WRAPPED_NATIVE_TOKEN,
        borrowAmount,
        rateMode
      );

      await this.debtWrappedNativeToken.approveDelegation(
        this.proxy.address,
        borrowAmount,
        {
          from: user,
        }
      );
      await balanceUser.get();
      const receipt = await this.proxy.execMock(to, data, {
        from: user,
        value: ether('0.1'),
      });

      const debtWrappedNativeTokenUserAfter =
        await this.debtWrappedNativeToken.balanceOf.call(user);
      // Verify proxy balance
      expect(await balanceProxy.get()).to.be.bignumber.zero;
      expect(
        await this.borrowToken.balanceOf.call(this.proxy.address)
      ).to.be.bignumber.zero;
      expect(
        await this.debtToken.balanceOf.call(this.proxy.address)
      ).to.be.bignumber.zero;

      // Verify user balance
      expect(
        debtWrappedNativeTokenUserAfter.sub(borrowWrappedNativeTokenUserBefore)
      ).to.be.bignumber.eq(borrowAmount);

      //  borrowAmount - 1 <= (debtTokenUserAfter-debtTokenUserBefore) < borrowAmount + interestMax
      const interestMax = borrowAmount.mul(new BN(1)).div(new BN(10000));
      expect(
        debtWrappedNativeTokenUserAfter.sub(debtWrappedNativeTokenUserBefore)
      ).to.be.bignumber.gte(borrowAmount.sub(new BN(1)));
      expect(
        debtWrappedNativeTokenUserAfter.sub(debtWrappedNativeTokenUserBefore)
      ).to.be.bignumber.lt(borrowAmount.add(interestMax));

      profileGas(receipt);
    });

    it('borrow eth', async function () {
      const borrowAmount = ether('1');
      const to = this.hRadiant.address;
      const data = abi.simpleEncode(
        'borrowETH(uint256,uint256)',
        borrowAmount,
        rateMode
      );
      await this.debtWrappedNativeToken.approveDelegation(
        this.proxy.address,
        borrowAmount,
        {
          from: user,
        }
      );
      const balancerUserBefore = await balanceUser.get();
      const receipt = await this.proxy.execMock(to, data, {
        from: user,
        value: ether('0.1'),
      });

      const balancerUserAfter = await balanceUser.get();
      const debtWrappedNativeTokenUserAfter =
        await this.debtWrappedNativeToken.balanceOf.call(user);
      // Verify proxy balance
      expect(await balanceProxy.get()).to.be.bignumber.zero;
      expect(
        await this.debtToken.balanceOf.call(this.proxy.address)
      ).to.be.bignumber.zero;

      // Verify user balance
      expect(balancerUserAfter.sub(balancerUserBefore)).to.be.bignumber.eq(
        borrowAmount
      );

      //  borrowAmount - 1 <= (debtTokenUserAfter-debtTokenUserBefore) < borrowAmount + interestMax
      const interestMax = borrowAmount.mul(new BN(1)).div(new BN(10000));
      expect(
        debtWrappedNativeTokenUserAfter.sub(debtWrappedNativeTokenUserBefore)
      ).to.be.bignumber.gte(borrowAmount.sub(new BN(1)));
      expect(
        debtWrappedNativeTokenUserAfter.sub(debtWrappedNativeTokenUserBefore)
      ).to.be.bignumber.lt(borrowAmount.add(interestMax));
      profileGas(receipt);
    });

    it('should revert: borrow token over the collateral value', async function () {
      const borrowAmount = ether('20000');
      const to = this.hRadiant.address;
      const data = abi.simpleEncode(
        'borrow(address,uint256,uint256)',
        this.borrowToken.address,
        borrowAmount,
        rateMode
      );
      await this.debtWrappedNativeToken.approveDelegation(
        this.proxy.address,
        borrowAmount,
        {
          from: user,
        }
      );

      await expectRevert(
        this.proxy.execMock(to, data, { from: user, value: ether('0.1') }),
        'HRadiant_borrow: 11' // Radiant Error Code: VL_COLLATERAL_CANNOT_COVER_NEW_BORROW
      );
    });

    it('should revert: borrow token without approveDelegation', async function () {
      const borrowAmount = mwei('2');
      const to = this.hRadiant.address;
      const data = abi.simpleEncode(
        'borrow(address,uint256,uint256)',
        this.borrowToken.address,
        borrowAmount,
        rateMode
      );

      await expectRevert(
        this.proxy.execMock(to, data, { from: user }),
        'HRadiant_borrow: 59' // Radiant Error Code: BORROW_ALLOWANCE_NOT_ENOUGH
      );
    });

    it('should revert: borrow token that is not in radiant pool', async function () {
      const borrowAmount = ether('2');
      const to = this.hRadiant.address;
      const data = abi.simpleEncode(
        'borrow(address,uint256,uint256)',
        COMP_TOKEN,
        borrowAmount,
        rateMode
      );
      await expectRevert(
        this.proxy.execMock(to, data, { from: user }),
        'HRadiant_borrow: Unspecified' // Radiant Error Code: VL_NO_ACTIVE_RESERVE
      );
    });

    it('should revert: borrow token with no collateral', async function () {
      const borrowAmount = ether('2');
      const to = this.hRadiant.address;
      const data = abi.simpleEncode(
        'borrow(address,uint256,uint256)',
        this.borrowToken.address,
        borrowAmount,
        rateMode
      );

      await expectRevert(
        this.proxy.execMock(to, data, { from: someone }),
        'HRadiant_borrow: 9' // Radiant Error Code: VL_COLLATERAL_BALANCE_IS_0
      );
    });

    it('should revert: borrow token is the same with collateral', async function () {
      const borrowAmount = ether('2');
      const to = this.hRadiant.address;
      const data = abi.simpleEncode(
        'borrow(address,uint256,uint256)',
        this.token.address,
        borrowAmount,
        rateMode
      );

      await this.debtWrappedNativeToken.approveDelegation(user, borrowAmount, {
        from: user,
      });

      await expectRevert(
        this.proxy.execMock(to, data, { from: user }),
        'HRadiant_borrow: 59' // Radiant Error Code: BORROW_ALLOWANCE_NOT_ENOUGH
        // Variable rate doesn't check collateral and debt
      );
    });
  });
});
