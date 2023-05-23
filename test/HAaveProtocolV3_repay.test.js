const chainId = network.config.chainId;

if (
  chainId == 1 ||
  chainId == 10 ||
  chainId == 137 ||
  chainId == 1088 ||
  chainId == 42161 ||
  chainId == 43114
) {
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
  WETH_TOKEN,
  USDC_TOKEN,
  ADAI_V3_TOKEN,
  WRAPPED_NATIVE_TOKEN,
  AAVEPROTOCOL_V3_PROVIDER,
  AWRAPPED_NATIVE_V3_DEBT_VARIABLE,
  AUSDC_V3_DEBT_STABLE,
  AUSDC_V3_DEBT_VARIABLE,
  AAVE_RATEMODE,
} = require('./utils/constants');
const {
  evmRevert,
  evmSnapshot,
  profileGas,
  getHandlerReturn,
  expectEqWithinBps,
  getTokenProvider,
  mwei,
} = require('./utils/utils');

const HAaveV3 = artifacts.require('HAaveProtocolV3');
const FeeRuleRegistry = artifacts.require('FeeRuleRegistry');
const Registry = artifacts.require('Registry');
const Proxy = artifacts.require('ProxyMock');
const IToken = artifacts.require('IERC20');
const IAToken = artifacts.require('IATokenV3');
const IPool = artifacts.require('contracts/handlers/aaveV3/IPool.sol:IPool');
const IProvider = artifacts.require('IPoolAddressesProvider');
const SimpleToken = artifacts.require('SimpleToken');

contract('Aave V3', function ([_, user]) {
  const aTokenAddress = ADAI_V3_TOKEN;
  const tokenAddress = DAI_TOKEN;

  let id;
  let balanceUser;
  let providerAddress;

  before(async function () {
    providerAddress = await getTokenProvider(tokenAddress, WETH_TOKEN, 3000);

    this.feeRuleRegistry = await FeeRuleRegistry.new('0', _);
    this.registry = await Registry.new();
    this.proxy = await Proxy.new(
      this.registry.address,
      this.feeRuleRegistry.address
    );
    this.hAaveV3 = await HAaveV3.new(
      WRAPPED_NATIVE_TOKEN,
      AAVEPROTOCOL_V3_PROVIDER
    );
    await this.registry.register(
      this.hAaveV3.address,
      utils.asciiToHex('AaveProtocolV3')
    );
    this.provider = await IProvider.at(AAVEPROTOCOL_V3_PROVIDER);
    this.poolAddress = await this.provider.getPool();
    this.pool = await IPool.at(this.poolAddress);
    this.token = await IToken.at(tokenAddress);
    this.aToken = await IAToken.at(aTokenAddress);
    this.wrappedNativeToken = await IToken.at(WRAPPED_NATIVE_TOKEN);

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

  describe('Repay Stable Rate', function () {
    if (chainId == 1 || chainId == 1088) {
      // Ethereum and Metis does not support borrow in stable mode
      return;
    }
    var supplyAmount = ether('5000');
    const borrowAmount = mwei('2');
    const borrowTokenAddr = USDC_TOKEN;
    const rateMode = AAVE_RATEMODE.STABLE;
    const debtTokenAddr = AUSDC_V3_DEBT_STABLE;

    let borrowTokenProvider;
    let borrowTokenUserBefore;
    let debtTokenUserBefore;

    before(async function () {
      borrowTokenProvider = await getTokenProvider(borrowTokenAddr);

      this.borrowToken = await IToken.at(borrowTokenAddr);
      this.debtToken = await IToken.at(debtTokenAddr);
    });

    beforeEach(async function () {
      // Deposit
      await this.token.approve(this.pool.address, supplyAmount, {
        from: providerAddress,
      });
      expect(await this.aToken.balanceOf(user)).to.be.bignumber.zero;
      await this.pool.supply(this.token.address, supplyAmount, user, 0, {
        from: providerAddress,
      });
      expectEqWithinBps(await this.aToken.balanceOf(user), supplyAmount, 1);

      // Borrow
      await this.pool.borrow(
        this.borrowToken.address,
        borrowAmount,
        rateMode,
        0,
        user,
        { from: user }
      );
      expect(await this.borrowToken.balanceOf(user)).to.be.bignumber.eq(
        borrowAmount
      );
      expectEqWithinBps(await this.debtToken.balanceOf(user), borrowAmount, 1);

      borrowTokenUserBefore = await this.borrowToken.balanceOf(user);
      debtTokenUserBefore = await this.debtToken.balanceOf(user);
    });

    it('partial', async function () {
      const repayAmount = borrowAmount.div(new BN('2'));
      const to = this.hAaveV3.address;
      const data = abi.simpleEncode(
        'repay(address,uint256,uint256,address)',
        this.borrowToken.address,
        repayAmount,
        rateMode,
        user
      );

      await this.borrowToken.transfer(this.proxy.address, repayAmount, {
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
      const borrowTokenUserAfter = await this.borrowToken.balanceOf(user);
      const debtTokenUserAfter = await this.debtToken.balanceOf(user);

      // Verify handler return
      expectEqWithinBps(handlerReturn, debtTokenUserBefore.sub(repayAmount), 1);

      // Verify proxy balance
      expect(
        await this.borrowToken.balanceOf(this.proxy.address)
      ).to.be.bignumber.zero;

      // Verify user balance
      expectEqWithinBps(
        debtTokenUserBefore.sub(debtTokenUserAfter),
        repayAmount,
        1
      );
      expect(
        borrowTokenUserBefore.sub(borrowTokenUserAfter)
      ).to.be.bignumber.eq(repayAmount);
      expect(await balanceUser.delta()).to.be.bignumber.eq(ether('0'));
      profileGas(receipt);
    });

    it('whole', async function () {
      const extraNeed = mwei('1');
      const repayAmount = borrowAmount.add(extraNeed);
      const to = this.hAaveV3.address;
      const data = abi.simpleEncode(
        'repay(address,uint256,uint256,address)',
        this.borrowToken.address,
        repayAmount,
        rateMode,
        user
      );
      await this.borrowToken.transfer(user, extraNeed, {
        from: borrowTokenProvider,
      });
      await this.borrowToken.transfer(this.proxy.address, repayAmount, {
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
      const borrowTokenUserAfter = await this.borrowToken.balanceOf(user);
      const debtTokenUserAfter = await this.debtToken.balanceOf(user);

      // Verify handler return
      expect(handlerReturn).to.be.bignumber.zero;

      // Verify proxy balance
      expect(
        await this.borrowToken.balanceOf(this.proxy.address)
      ).to.be.bignumber.zero;

      // Verify user balance
      expect(debtTokenUserAfter).to.be.bignumber.zero;
      expectEqWithinBps(borrowTokenUserAfter, extraNeed, 1);
      expect(await balanceUser.delta()).to.be.bignumber.eq(ether('0'));
      profileGas(receipt);
    });

    it('should revert: not enough balance', async function () {
      const repayAmount = mwei('0.5');
      const to = this.hAaveV3.address;
      const data = abi.simpleEncode(
        'repay(address,uint256,uint256,address)',
        this.borrowToken.address,
        repayAmount,
        rateMode,
        user
      );

      await this.borrowToken.transfer(
        this.proxy.address,
        repayAmount.sub(mwei('0.1')),
        { from: user }
      );
      await this.proxy.updateTokenMock(this.borrowToken.address);
      await expectRevert(
        this.proxy.execMock(to, data, { from: user }),
        'HAaveProtocolV3_repay: ERC20: transfer amount exceeds balance'
      );
    });

    it('should revert: unsupported token', async function () {
      const repayAmount = ether('0.5');
      const to = this.hAaveV3.address;
      const data = abi.simpleEncode(
        'repay(address,uint256,uint256,address)',
        this.mockToken.address,
        repayAmount,
        rateMode,
        user
      );

      await this.mockToken.transfer(this.proxy.address, repayAmount, {
        from: _,
      });
      await this.proxy.updateTokenMock(this.mockToken.address);
      await expectRevert(
        this.proxy.execMock(to, data, { from: user }),
        'HAaveProtocolV3_repay: Unspecified'
      );
    });

    it('should revert: wrong rate mode', async function () {
      const repayAmount = mwei('0.5');
      const to = this.hAaveV3.address;
      const unborrowedRateMode = (rateMode % 2) + 1;
      const data = abi.simpleEncode(
        'repay(address,uint256,uint256,address)',
        this.borrowToken.address,
        repayAmount,
        unborrowedRateMode,
        user
      );

      await this.borrowToken.transfer(this.proxy.address, repayAmount, {
        from: user,
      });
      await this.proxy.updateTokenMock(this.borrowToken.address);
      await expectRevert(
        this.proxy.execMock(to, data, { from: user }),
        'HAaveProtocolV3_repay: 39' // AAVEV3 Error Code: NO_DEBT_OF_SELECTED_TYPE
      );
    });
  });

  describe('Repay Variable Rate', function () {
    var supplyAmount = ether('5000');
    const borrowAmount = chainId == 1088 ? mwei('1') : ether('1');
    const borrowTokenAddr = chainId == 1088 ? USDC_TOKEN : WRAPPED_NATIVE_TOKEN;
    const rateMode = AAVE_RATEMODE.VARIABLE;
    const debtTokenAddr =
      chainId == 1088
        ? AUSDC_V3_DEBT_VARIABLE
        : AWRAPPED_NATIVE_V3_DEBT_VARIABLE;

    let borrowTokenProvider;
    let borrowTokenUserBefore;
    let debtTokenUserBefore;

    before(async function () {
      borrowTokenProvider = await getTokenProvider(borrowTokenAddr);

      this.borrowToken = await IToken.at(borrowTokenAddr);
      this.debtToken = await IToken.at(debtTokenAddr);
    });

    beforeEach(async function () {
      // Deposit
      await this.token.approve(this.pool.address, supplyAmount, {
        from: providerAddress,
      });
      await this.pool.supply(this.token.address, supplyAmount, user, 0, {
        from: providerAddress,
      });
      supplyAmount = await this.aToken.balanceOf(user);

      // Borrow
      await this.pool.borrow(
        this.borrowToken.address,
        borrowAmount,
        rateMode,
        0,
        user,
        { from: user }
      );

      expect(await this.borrowToken.balanceOf(user)).to.be.bignumber.eq(
        borrowAmount
      );
      expectEqWithinBps(await this.debtToken.balanceOf(user), borrowAmount, 1);

      borrowTokenUserBefore = await this.borrowToken.balanceOf(user);
      debtTokenUserBefore = await this.debtToken.balanceOf(user);
    });

    it('partial', async function () {
      const repayAmount = borrowAmount.div(new BN('2'));
      const to = this.hAaveV3.address;
      const data = abi.simpleEncode(
        'repay(address,uint256,uint256,address)',
        this.borrowToken.address,
        repayAmount,
        rateMode,
        user
      );
      await this.borrowToken.transfer(this.proxy.address, repayAmount, {
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
      const borrowTokenUserAfter = await this.borrowToken.balanceOf(user);
      const debtTokenUserAfter = await this.debtToken.balanceOf(user);

      // Verify handler return
      expectEqWithinBps(handlerReturn, debtTokenUserBefore.sub(repayAmount), 1);

      // Verify proxy balance
      expect(
        await this.borrowToken.balanceOf(this.proxy.address)
      ).to.be.bignumber.zero;

      // Verify user balance
      expectEqWithinBps(
        debtTokenUserBefore.sub(debtTokenUserAfter),
        repayAmount,
        1
      );
      expect(
        borrowTokenUserBefore.sub(borrowTokenUserAfter)
      ).to.be.bignumber.eq(repayAmount);
      expect(await balanceUser.delta()).to.be.bignumber.eq(ether('0'));
      profileGas(receipt);
    });

    it('partial by ETH', async function () {
      // metis chain only use repay(address,uint256,uint256,address) function
      if (chainId == 1088) {
        return;
      }
      const repayAmount = borrowAmount.div(new BN('2'));
      const to = this.hAaveV3.address;
      const data = abi.simpleEncode(
        'repayETH(uint256,uint256,address)',
        repayAmount,
        rateMode,
        user
      );
      await balanceUser.get();

      const receipt = await this.proxy.execMock(to, data, {
        from: user,
        value: repayAmount,
      });

      // Get handler return result
      const handlerReturn = utils.toBN(
        getHandlerReturn(receipt, ['uint256'])[0]
      );
      const debtTokenUserAfter = await this.debtToken.balanceOf(user);

      // Verify handler return
      expectEqWithinBps(handlerReturn, debtTokenUserBefore.sub(repayAmount), 1);

      // Verify proxy balance
      expect(
        await this.borrowToken.balanceOf(this.proxy.address)
      ).to.be.bignumber.zero;

      // Verify user balance
      expectEqWithinBps(
        debtTokenUserBefore.sub(debtTokenUserAfter),
        repayAmount,
        1
      );
      expect(await balanceUser.delta()).to.be.bignumber.eq(
        ether('0').sub(repayAmount)
      );
      profileGas(receipt);
    });

    it('whole', async function () {
      const extraNeed = borrowAmount;
      const repayAmount = borrowAmount.add(extraNeed);
      const to = this.hAaveV3.address;
      const data = abi.simpleEncode(
        'repay(address,uint256,uint256,address)',
        this.borrowToken.address,
        repayAmount,
        rateMode,
        user
      );
      await this.borrowToken.transfer(user, extraNeed, {
        from: borrowTokenProvider,
      });
      await this.borrowToken.transfer(this.proxy.address, repayAmount, {
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
      const borrowTokenUserAfter = await this.borrowToken.balanceOf(user);
      const debtTokenUserAfter = await this.debtToken.balanceOf(user);

      // Verify handler return
      expect(handlerReturn).to.be.bignumber.zero;

      // Verify proxy balance
      expect(
        await this.borrowToken.balanceOf(this.proxy.address)
      ).to.be.bignumber.zero;

      // Verify user balance
      expect(debtTokenUserAfter).to.be.bignumber.zero;
      expectEqWithinBps(borrowTokenUserAfter, extraNeed, 1);
      expect(await balanceUser.delta()).to.be.bignumber.eq(ether('0'));
      profileGas(receipt);
    });

    it('whole by ETH', async function () {
      if (chainId == 1088) {
        return;
      }
      const extraNeed = ether('1');
      const repayAmount = borrowAmount.add(extraNeed);
      const to = this.hAaveV3.address;
      const data = abi.simpleEncode(
        'repayETH(uint256,uint256,address)',
        repayAmount,
        rateMode,
        user
      );
      const borrowWrappedNativeTokenUserBefore =
        await this.wrappedNativeToken.balanceOf(user);
      await balanceUser.get();

      const receipt = await this.proxy.execMock(to, data, {
        from: user,
        value: repayAmount,
      });

      // Get handler return result
      const handlerReturn = utils.toBN(
        getHandlerReturn(receipt, ['uint256'])[0]
      );
      const debtTokenUserAfter = await this.debtToken.balanceOf(user);
      const borrowWrappedNativeTokenUserAfter =
        await this.wrappedNativeToken.balanceOf(user);

      // Verify handler return
      expect(handlerReturn).to.be.bignumber.zero;

      // Verify proxy balance
      expect(
        await this.borrowToken.balanceOf(this.proxy.address)
      ).to.be.bignumber.zero;

      // Verify user balance
      expect(debtTokenUserAfter).to.be.bignumber.zero;
      expectEqWithinBps(
        borrowWrappedNativeTokenUserAfter.sub(
          borrowWrappedNativeTokenUserBefore
        ),
        extraNeed,
        1
      );
      expect(await balanceUser.delta()).to.be.bignumber.eq(
        ether('0').sub(repayAmount)
      );
      profileGas(receipt);
    });

    it('should revert: unsupported repayETH', async function () {
      if (chainId != 1088) {
        return;
      }
      const repayAmount = borrowAmount.div(new BN('2'));
      const to = this.hAaveV3.address;
      const data = abi.simpleEncode(
        'repayETH(uint256,uint256,address)',
        repayAmount,
        rateMode,
        user
      );
      await expectRevert(
        this.proxy.execMock(to, data, {
          from: user,
          value: repayAmount,
        }),
        '0_HAaveProtocolV3_repay: Unspecified'
      );
    });

    it('should revert: not enough balance', async function () {
      const repayAmount = borrowAmount.div(new BN('2'));
      const to = this.hAaveV3.address;
      const data = abi.simpleEncode(
        'repay(address,uint256,uint256,address)',
        this.borrowToken.address,
        repayAmount,
        rateMode,
        user
      );

      await this.borrowToken.transfer(
        this.proxy.address,
        repayAmount.div(new BN('2')),
        { from: user }
      );
      await this.proxy.updateTokenMock(this.borrowToken.address);

      // FIXME: revert message is different on metis and arbitrum
      if (chainId == 1088 || chainId == 42161) {
        await expectRevert(
          this.proxy.execMock(to, data, { from: user }),
          '0_HAaveProtocolV3_repay: ERC20: transfer amount exceeds balance'
        );
      } else {
        await expectRevert(
          this.proxy.execMock(to, data, { from: user }),
          'HAaveProtocolV3_repay: Unspecified'
        );
      }
    });

    it('should revert: unsupported token', async function () {
      const repayAmount = borrowAmount;
      const to = this.hAaveV3.address;
      const data = abi.simpleEncode(
        'repay(address,uint256,uint256,address)',
        this.mockToken.address,
        repayAmount,
        rateMode,
        user
      );

      await this.mockToken.transfer(this.proxy.address, repayAmount, {
        from: _,
      });
      await this.proxy.updateTokenMock(this.mockToken.address);
      await expectRevert(
        this.proxy.execMock(to, data, { from: user }),
        'HAaveProtocolV3_repay: Unspecified'
      );
    });

    it('should revert: wrong rate mode', async function () {
      const repayAmount = borrowAmount;
      const to = this.hAaveV3.address;
      const unborrowedRateMode = (rateMode % 2) + 1;
      const data = abi.simpleEncode(
        'repay(address,uint256,uint256,address)',
        this.borrowToken.address,
        repayAmount,
        unborrowedRateMode,
        user
      );

      await this.borrowToken.transfer(this.proxy.address, repayAmount, {
        from: user,
      });
      await this.proxy.updateTokenMock(this.borrowToken.address);
      await expectRevert(
        this.proxy.execMock(to, data, { from: user }),
        'HAaveProtocolV3_repay: 39' // AAVEV3 Error Code: NO_DEBT_OF_SELECTED_TYPE
      );
    });
  });
});
