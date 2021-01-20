const {
  balance,
  BN,
  constants,
  ether,
  expectEvent,
  expectRevert,
  time,
} = require('@openzeppelin/test-helpers');
const { MAX_UINT256 } = constants;
const { tracker } = balance;
const { latest } = time;
const abi = require('ethereumjs-abi');
const util = require('ethereumjs-util');
const utils = web3.utils;

const { expect } = require('chai');

const {
  ETH_TOKEN,
  WETH_TOKEN,
  WETH_PROVIDER,
  DAI_TOKEN,
  DAI_PROVIDER,
  TUSD_TOKEN,
  COMP_TOKEN,
  AAVEPROTOCOL_V2_PROVIDER,
  ADAI_V2,
  AWETH_V2,
  ALINK,
  AWETH_V2_DEBT_STABLE,
  AWETH_V2_DEBT_VARIABLE,
  ATUSD_V2_DEBT_STABLE,
  ATUSD_V2_DEBT_VARIABLE,
  AAVE_RATEMODE,
} = require('./utils/constants');
const {
  evmRevert,
  evmSnapshot,
  profileGas,
  getHandlerReturn,
  mulPercent,
} = require('./utils/utils');

const HAaveV2 = artifacts.require('HAaveProtocolV2');
const Registry = artifacts.require('Registry');
const Proxy = artifacts.require('ProxyMock');
const IToken = artifacts.require('IERC20');
const IAToken = artifacts.require('IATokenV2');
const ILendingPool = artifacts.require('ILendingPoolV2');
const IProvider = artifacts.require('ILendingPoolAddressesProviderV2');
const SimpleToken = artifacts.require('SimpleToken');

const IStableDebtToken = artifacts.require('IStableDebtToken');
const IVariableDebtToken = artifacts.require('IVariableDebtToken');

contract('Aave V2', function([_, user, someone]) {
  const aTokenAddress = ADAI_V2;
  const tokenAddress = DAI_TOKEN;
  const providerAddress = DAI_PROVIDER;
  const awethAddress = AWETH_V2;
  const etherAddress = ETH_TOKEN;
  const wethAddress = WETH_TOKEN;
  const wethProviderAddress = WETH_PROVIDER;

  let id;
  let balanceUser;
  let balanceProxy;

  before(async function() {
    this.registry = await Registry.new();
    this.proxy = await Proxy.new(this.registry.address);
    this.hAaveV2 = await HAaveV2.new();
    await this.registry.register(
      this.hAaveV2.address,
      utils.asciiToHex('AaveProtocolV2')
    );
    this.provider = await IProvider.at(AAVEPROTOCOL_V2_PROVIDER);
    this.lendingPoolAddress = await this.provider.getLendingPool.call();
    this.lendingPool = await ILendingPool.at(this.lendingPoolAddress);
    this.token = await IToken.at(tokenAddress);
    this.aToken = await IAToken.at(aTokenAddress);
    this.ether = etherAddress;
    this.weth = await IToken.at(WETH_TOKEN);
    this.aweth = await IAToken.at(awethAddress);
    this.mockToken = await SimpleToken.new();
  });

  beforeEach(async function() {
    id = await evmSnapshot();
    balanceUser = await tracker(user);
    balanceProxy = await tracker(this.proxy.address);
  });

  afterEach(async function() {
    await evmRevert(id);
  });

  describe('Deposit', function() {
    describe('Ether', function() {
      it('normal', async function() {
        const value = ether('10');
        const to = this.hAaveV2.address;
        const data = abi.simpleEncode('depositETH(uint256)', value);

        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: value,
        });
        expect(await balanceProxy.get()).to.be.zero;
        expect(await this.aweth.balanceOf.call(this.proxy.address)).to.be.zero;
        expect(await this.aweth.balanceOf.call(user)).to.be.bignumber.eq(value);
        expect(await balanceUser.delta()).to.be.bignumber.eq(
          ether('0')
            .sub(value)
            .sub(new BN(receipt.receipt.gasUsed))
        );
        profileGas(receipt);
      });

      it('max amount', async function() {
        const value = ether('10');
        const to = this.hAaveV2.address;
        const data = abi.simpleEncode('depositETH(uint256)', MAX_UINT256);

        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: value,
        });
        expect(await balanceProxy.get()).to.be.zero;
        expect(await this.aweth.balanceOf.call(this.proxy.address)).to.be.zero;
        expect(await this.aweth.balanceOf.call(user)).to.be.bignumber.eq(value);
        expect(await balanceUser.delta()).to.be.bignumber.eq(
          ether('0')
            .sub(value)
            .sub(new BN(receipt.receipt.gasUsed))
        );
        profileGas(receipt);
      });
    });

    describe('Token', function() {
      it('normal', async function() {
        const value = ether('10');
        const to = this.hAaveV2.address;
        const data = abi.simpleEncode(
          'deposit(address,uint256)',
          this.token.address,
          value
        );

        await this.token.transfer(this.proxy.address, value, {
          from: providerAddress,
        });
        await this.proxy.updateTokenMock(this.token.address);

        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: ether('0.1'),
        });
        expect(await balanceProxy.get()).to.be.zero;
        expect(await this.aToken.balanceOf.call(this.proxy.address)).to.be.zero;
        expect(await this.aToken.balanceOf.call(user)).to.be.bignumber.eq(
          value
        );
        expect(await balanceUser.delta()).to.be.bignumber.eq(
          ether('0').sub(new BN(receipt.receipt.gasUsed))
        );
        profileGas(receipt);
      });

      it('max amount', async function() {
        const value = ether('10');
        const to = this.hAaveV2.address;
        const data = abi.simpleEncode(
          'deposit(address,uint256)',
          this.token.address,
          MAX_UINT256
        );

        await this.token.transfer(this.proxy.address, value, {
          from: providerAddress,
        });
        await this.proxy.updateTokenMock(this.token.address);

        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: ether('0.1'),
        });
        expect(await balanceProxy.get()).to.be.zero;
        expect(await this.aToken.balanceOf.call(this.proxy.address)).to.be.zero;
        expect(await this.aToken.balanceOf.call(user)).to.be.bignumber.eq(
          value
        );
        expect(await balanceUser.delta()).to.be.bignumber.eq(
          ether('0').sub(new BN(receipt.receipt.gasUsed))
        );
        profileGas(receipt);
      });

      it('should revert: not supported token', async function() {
        const value = ether('10');
        const to = this.hAaveV2.address;
        const data = abi.simpleEncode(
          'deposit(address,uint256)',
          this.mockToken.address,
          value
        );
        await this.mockToken.transfer(this.proxy.address, value, { from: _ });
        await expectRevert(
          this.proxy.execMock(to, data, { from: user }),
          'HAaveProtocolV2_General: aToken should not be zero address'
        );
      });
    });
  });

  describe('Withdraw', function() {
    const depositAmount = ether('10');

    describe('Ether', function() {
      beforeEach(async function() {
        await this.weth.approve(this.lendingPool.address, depositAmount, {
          from: wethProviderAddress,
        });
        await this.lendingPool.deposit(
          this.weth.address,
          depositAmount,
          user,
          0,
          { from: wethProviderAddress }
        );
        expect(await this.aweth.balanceOf.call(user)).to.be.bignumber.eq(
          depositAmount
        );
      });

      it('partial', async function() {
        const value = ether('5');
        const to = this.hAaveV2.address;
        const data = abi.simpleEncode('withdrawETH(uint256)', value);
        await this.aweth.transfer(this.proxy.address, value, { from: user });
        await this.proxy.updateTokenMock(this.aweth.address);
        await balanceUser.get();

        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: ether('0.1'),
        });

        // Get handler return result
        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );
        const aTokenUserAfter = await this.aweth.balanceOf.call(user);
        const interestMax = depositAmount.mul(new BN(1)).div(new BN(10000));

        // Verify handler return
        expect(value).to.be.bignumber.eq(handlerReturn);
        // Verify proxy balance
        expect(await this.aweth.balanceOf.call(this.proxy.address)).to.be.zero;
        // Verify user balance
        // (deposit - withdraw) <= aTokenAfter < (deposit + interestMax - withdraw)
        expect(aTokenUserAfter).to.be.bignumber.gte(depositAmount.sub(value));
        expect(aTokenUserAfter).to.be.bignumber.lt(
          depositAmount.add(interestMax).sub(value)
        );
        expect(await balanceUser.delta()).to.be.bignumber.eq(
          value.sub(new BN(receipt.receipt.gasUsed))
        );
        profileGas(receipt);
      });

      it('max amount', async function() {
        const value = ether('5');
        const to = this.hAaveV2.address;
        const data = abi.simpleEncode('withdrawETH(uint256)', MAX_UINT256);
        await this.aweth.transfer(this.proxy.address, value, { from: user });
        await this.proxy.updateTokenMock(this.aweth.address);
        await balanceUser.get();

        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: ether('0.1'),
        });

        // Get handler return result
        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );
        const aTokenUserAfter = await this.aweth.balanceOf.call(user);
        const interestMax = depositAmount.mul(new BN(1)).div(new BN(10000));

        // Verify handler return
        // value  <= handlerReturn  <= value*1.01
        // Because AToken could be increase by timestamp in proxy
        expect(value).to.be.bignumber.lte(handlerReturn);
        expect(mulPercent(value, 101)).to.be.bignumber.gte(handlerReturn);

        // Verify proxy balance
        expect(await this.aweth.balanceOf.call(this.proxy.address)).to.be.zero;
        // Verify user balance
        // (deposit - withdraw) <= aTokenAfter < (deposit + interestMax - withdraw)
        expect(aTokenUserAfter).to.be.bignumber.gte(
          depositAmount.sub(handlerReturn)
        );
        expect(aTokenUserAfter).to.be.bignumber.lt(
          depositAmount.add(interestMax).sub(handlerReturn)
        );
        expect(await balanceUser.delta()).to.be.bignumber.eq(
          value.sub(new BN(receipt.receipt.gasUsed))
        );
        profileGas(receipt);
      });
    });

    describe('Token', function() {
      beforeEach(async function() {
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
        expect(await this.aToken.balanceOf.call(user)).to.be.bignumber.eq(
          depositAmount
        );
      });

      it('partial', async function() {
        const value = ether('5');
        const to = this.hAaveV2.address;
        const data = abi.simpleEncode(
          'withdraw(address,uint256)',
          this.token.address,
          value
        );
        await this.aToken.transfer(this.proxy.address, value, { from: user });
        await this.proxy.updateTokenMock(this.aToken.address);
        await balanceUser.get();

        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: ether('0.1'),
        });

        // Get handler return result
        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );
        const aTokenUserAfter = await this.aToken.balanceOf.call(user);
        const tokenUserAfter = await this.token.balanceOf.call(user);
        const interestMax = depositAmount.mul(new BN(1)).div(new BN(10000));

        // Verify handler return
        expect(value).to.be.bignumber.eq(handlerReturn);
        // Verify proxy balance
        expect(await this.aToken.balanceOf.call(this.proxy.address)).to.be.zero;
        expect(await this.token.balanceOf.call(this.proxy.address)).to.be.zero;

        // Verify user balance
        // (deposit - withdraw) <= aTokenAfter < (deposit + interestMax - withdraw)
        expect(aTokenUserAfter).to.be.bignumber.gte(depositAmount.sub(value));
        expect(aTokenUserAfter).to.be.bignumber.lt(
          depositAmount.add(interestMax).sub(value)
        );
        expect(tokenUserAfter).to.be.bignumber.eq(value);
        expect(await balanceUser.delta()).to.be.bignumber.eq(
          ether('0').sub(new BN(receipt.receipt.gasUsed))
        );
        profileGas(receipt);
      });

      it('max amount', async function() {
        const value = ether('5');
        const to = this.hAaveV2.address;
        const data = abi.simpleEncode(
          'withdraw(address,uint256)',
          this.token.address,
          MAX_UINT256
        );
        await this.aToken.transfer(this.proxy.address, value, { from: user });
        await this.proxy.updateTokenMock(this.aToken.address);
        await balanceUser.get();

        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: ether('0.1'),
        });

        // Get handler return result
        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );
        const aTokenUserAfter = await this.aToken.balanceOf.call(user);
        const tokenUserAfter = await this.token.balanceOf.call(user);
        const interestMax = depositAmount.mul(new BN(1)).div(new BN(10000));

        // Verify handler return
        // value  <= handlerReturn  <= value*1.01
        // Because AToken could be increase by timestamp in proxy
        expect(value).to.be.bignumber.lte(handlerReturn);
        expect(mulPercent(value, 101)).to.be.bignumber.gte(handlerReturn);

        // Verify proxy balance
        expect(await this.aToken.balanceOf.call(this.proxy.address)).to.be.zero;
        expect(await this.token.balanceOf.call(this.proxy.address)).to.be.zero;
        // Verify user balance
        // (deposit - withdraw) <= aTokenAfter < (deposit + interestMax - withdraw)
        expect(aTokenUserAfter).to.be.bignumber.gte(
          depositAmount.sub(handlerReturn)
        );
        expect(aTokenUserAfter).to.be.bignumber.lt(
          depositAmount.add(interestMax).sub(handlerReturn)
        );
        expect(tokenUserAfter).to.be.bignumber.eq(handlerReturn);
        expect(await balanceUser.delta()).to.be.bignumber.eq(
          ether('0').sub(new BN(receipt.receipt.gasUsed))
        );
        profileGas(receipt);
      });

      it('whole', async function() {
        const value = MAX_UINT256;
        const to = this.hAaveV2.address;
        const data = abi.simpleEncode(
          'withdraw(address,uint256)',
          this.token.address,
          value
        );
        await this.aToken.transfer(
          this.proxy.address,
          await this.aToken.balanceOf.call(user),
          { from: user }
        );
        await this.proxy.updateTokenMock(this.aToken.address);
        await balanceUser.get();

        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: ether('0.1'),
        });

        // Get handler return result
        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );
        const aTokenUserAfter = await this.aToken.balanceOf.call(user);
        const tokenUserAfter = await this.token.balanceOf.call(user);

        // Verify handler return
        expect(handlerReturn).to.be.bignumber.gte(depositAmount);
        // Verify proxy balance
        expect(await this.aToken.balanceOf.call(this.proxy.address)).to.be.zero;
        expect(await this.token.balanceOf.call(this.proxy.address)).to.be.zero;
        // Verify user balance
        expect(aTokenUserAfter).to.be.zero;
        expect(tokenUserAfter).to.be.bignumber.eq(handlerReturn);
        expect(await balanceUser.delta()).to.be.bignumber.eq(
          ether('0').sub(new BN(receipt.receipt.gasUsed))
        );
        profileGas(receipt);
      });

      it('should revert: not enough balance', async function() {
        const value = depositAmount.add(ether('10'));
        const to = this.hAaveV2.address;
        const data = abi.simpleEncode(
          'withdraw(address,uint256)',
          this.token.address,
          value
        );

        await this.aToken.transfer(
          this.proxy.address,
          await this.aToken.balanceOf.call(user),
          { from: user }
        );
        await this.proxy.updateTokenMock(this.aToken.address);

        await expectRevert(
          this.proxy.execMock(to, data, { from: user }),
          'HAaveProtocolV2_withdraw: 5'
        );
      });

      it('should revert: not supported token', async function() {
        const value = depositAmount.add(ether('10'));
        const to = this.hAaveV2.address;
        const data = abi.simpleEncode(
          'withdraw(address,uint256)',
          this.mockToken.address,
          value
        );

        await expectRevert(
          this.proxy.execMock(to, data, { from: user }),
          'HAaveProtocolV2_General: aToken should not be zero address'
        );
      });
    });
  });

  describe('Repay Stable Rate', function() {
    const depositAmount = ether('10000');
    const borrowAmount = ether('1');
    const borrowTokenAddr = WETH_TOKEN;
    const borrowTokenProvider = WETH_PROVIDER;
    const rateMode = AAVE_RATEMODE.STABLE;
    const debtTokenAddr =
      rateMode == AAVE_RATEMODE.STABLE
        ? AWETH_V2_DEBT_STABLE
        : AWETH_V2_DEBT_VARIABLE;

    before(async function() {
      this.borrowToken = await IToken.at(borrowTokenAddr);
      this.debtToken = await IToken.at(debtTokenAddr);
    });

    beforeEach(async function() {
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
      expect(await this.aToken.balanceOf.call(user)).to.be.bignumber.eq(
        depositAmount
      );
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
      expect(await this.debtToken.balanceOf.call(user)).to.be.bignumber.eq(
        borrowAmount
      );
    });

    it('partial', async function() {
      const value = ether('0.5');
      const to = this.hAaveV2.address;
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
      expect(handlerReturn).to.be.bignumber.gte(borrowAmount.sub(value));
      expect(handlerReturn).to.be.bignumber.lt(
        borrowAmount.sub(value).add(interestMax)
      );
      // Verify proxy balance
      expect(
        await this.borrowToken.balanceOf.call(this.proxy.address)
      ).to.be.zero;
      // Verify user balance
      // (borrow - repay) <= debtTokenUserAfter < (borrow + interestMax - repay)
      expect(debtTokenUserAfter).to.be.bignumber.gte(borrowAmount.sub(value));
      expect(debtTokenUserAfter).to.be.bignumber.lt(
        borrowAmount.add(interestMax).sub(value)
      );
      expect(borrowTokenUserAfter).to.be.bignumber.eq(borrowAmount.sub(value));
      expect(await balanceUser.delta()).to.be.bignumber.eq(
        ether('0').sub(new BN(receipt.receipt.gasUsed))
      );
      profileGas(receipt);
    });

    it('partial by ETH', async function() {
      const value = ether('0.5');
      const to = this.hAaveV2.address;
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
      expect(handlerReturn).to.be.bignumber.gte(borrowAmount.sub(value));
      expect(handlerReturn).to.be.bignumber.lt(
        borrowAmount.sub(value).add(interestMax)
      );
      // Verify proxy balance
      expect(
        await this.borrowToken.balanceOf.call(this.proxy.address)
      ).to.be.zero;
      // Verify user balance
      // (borrow - repay) <= debtTokenUserAfter < (borrow + interestMax - repay)
      expect(debtTokenUserAfter).to.be.bignumber.gte(borrowAmount.sub(value));
      expect(debtTokenUserAfter).to.be.bignumber.lt(
        borrowAmount.add(interestMax).sub(value)
      );
      expect(await balanceUser.delta()).to.be.bignumber.eq(
        ether('0')
          .sub(value)
          .sub(new BN(receipt.receipt.gasUsed))
      );
      profileGas(receipt);
    });

    it('whole', async function() {
      const value = ether('2');
      const extraNeed = value.sub(borrowAmount);
      const to = this.hAaveV2.address;
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
      expect(handlerReturn).to.be.zero;
      // Verify proxy balance
      expect(
        await this.borrowToken.balanceOf.call(this.proxy.address)
      ).to.be.zero;
      // Verify user balance
      expect(debtTokenUserAfter).to.be.zero;
      // (repay - borrow - interestMax) < borrowTokenUserAfter <= (repay - borrow)
      expect(borrowTokenUserAfter).to.be.bignumber.lte(value.sub(borrowAmount));
      expect(borrowTokenUserAfter).to.be.bignumber.gt(
        value.sub(borrowAmount).sub(interestMax)
      );
      expect(await balanceUser.delta()).to.be.bignumber.eq(
        ether('0').sub(new BN(receipt.receipt.gasUsed))
      );
      profileGas(receipt);
    });

    it('whole by ETH', async function() {
      const value = ether('2');
      const to = this.hAaveV2.address;
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
      expect(handlerReturn).to.be.zero;
      // Verify proxy balance
      expect(
        await this.borrowToken.balanceOf.call(this.proxy.address)
      ).to.be.zero;
      // Verify user balance
      expect(debtTokenUserAfter).to.be.zero;
      // (repay - borrow - interestMax) < borrowTokenUserAfter <= (repay - borrow)
      expect(
        (await balanceUser.delta()).add(new BN(receipt.receipt.gasUsed))
      ).to.be.bignumber.lte(ether('0').sub(borrowAmount));
      expect(
        (await balanceUser.delta()).add(new BN(receipt.receipt.gasUsed))
      ).to.be.bignumber.gt(
        ether('0')
          .sub(borrowAmount)
          .sub(interestMax)
      );
      profileGas(receipt);
    });

    it('should revert: not enough balance', async function() {
      const value = ether('0.5');
      const to = this.hAaveV2.address;
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
        'HAaveProtocolV2_repay: SafeERC20: low-level call failed'
      );
    });

    it('should revert: not supported token', async function() {
      const value = ether('0.5');
      const to = this.hAaveV2.address;
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
        'HAaveProtocolV2_repay: Unspecified'
      );
    });

    it('should revert: wrong rate mode', async function() {
      const value = ether('0.5');
      const to = this.hAaveV2.address;
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
        'HAaveProtocolV2_repay: 15'
      );
    });
  });

  describe('Repay Variable Rate', function() {
    const depositAmount = ether('10000');
    const borrowAmount = ether('1');
    const borrowTokenAddr = WETH_TOKEN;
    const borrowTokenProvider = WETH_PROVIDER;
    const rateMode = AAVE_RATEMODE.VARIABLE;
    const debtTokenAddr = AWETH_V2_DEBT_VARIABLE;

    before(async function() {
      this.borrowToken = await IToken.at(borrowTokenAddr);
      this.debtToken = await IToken.at(debtTokenAddr);
    });

    beforeEach(async function() {
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
      expect(await this.aToken.balanceOf.call(user)).to.be.bignumber.eq(
        depositAmount
      );
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
      expect(await this.debtToken.balanceOf.call(user)).to.be.bignumber.eq(
        borrowAmount
      );
    });

    it('partial', async function() {
      const value = ether('0.5');
      const to = this.hAaveV2.address;
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
      expect(handlerReturn).to.be.bignumber.gte(borrowAmount.sub(value));
      expect(handlerReturn).to.be.bignumber.lt(
        borrowAmount.sub(value).add(interestMax)
      );
      // Verify proxy balance
      expect(
        await this.borrowToken.balanceOf.call(this.proxy.address)
      ).to.be.zero;
      // Verify user balance
      // (borrow - repay) <= debtTokenUserAfter < (borrow + interestMax - repay)
      expect(debtTokenUserAfter).to.be.bignumber.gte(borrowAmount.sub(value));
      expect(debtTokenUserAfter).to.be.bignumber.lt(
        borrowAmount.add(interestMax).sub(value)
      );
      expect(borrowTokenUserAfter).to.be.bignumber.eq(borrowAmount.sub(value));
      expect(await balanceUser.delta()).to.be.bignumber.eq(
        ether('0').sub(new BN(receipt.receipt.gasUsed))
      );
      profileGas(receipt);
    });

    it('partial by ETH', async function() {
      const value = ether('0.5');
      const to = this.hAaveV2.address;
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
      expect(handlerReturn).to.be.bignumber.gte(borrowAmount.sub(value));
      expect(handlerReturn).to.be.bignumber.lt(
        borrowAmount.sub(value).add(interestMax)
      );
      // Verify proxy balance
      expect(
        await this.borrowToken.balanceOf.call(this.proxy.address)
      ).to.be.zero;
      // Verify user balance
      // (borrow - repay) <= debtTokenUserAfter < (borrow + interestMax - repay)
      expect(debtTokenUserAfter).to.be.bignumber.gte(borrowAmount.sub(value));
      expect(debtTokenUserAfter).to.be.bignumber.lt(
        borrowAmount.add(interestMax).sub(value)
      );
      expect(await balanceUser.delta()).to.be.bignumber.eq(
        ether('0')
          .sub(value)
          .sub(new BN(receipt.receipt.gasUsed))
      );
      profileGas(receipt);
    });

    it('whole', async function() {
      const value = ether('2');
      const extraNeed = value.sub(borrowAmount);
      const to = this.hAaveV2.address;
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
      expect(handlerReturn).to.be.zero;
      // Verify proxy balance
      expect(
        await this.borrowToken.balanceOf.call(this.proxy.address)
      ).to.be.zero;
      // Verify user balance
      expect(debtTokenUserAfter).to.be.zero;
      // (repay - borrow - interestMax) < borrowTokenUserAfter <= (repay - borrow)
      expect(borrowTokenUserAfter).to.be.bignumber.lte(value.sub(borrowAmount));
      expect(borrowTokenUserAfter).to.be.bignumber.gt(
        value.sub(borrowAmount).sub(interestMax)
      );
      expect(await balanceUser.delta()).to.be.bignumber.eq(
        ether('0').sub(new BN(receipt.receipt.gasUsed))
      );
      profileGas(receipt);
    });

    it('whole by ETH', async function() {
      const value = ether('2');
      const to = this.hAaveV2.address;
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
      expect(handlerReturn).to.be.zero;
      // Verify proxy balance
      expect(
        await this.borrowToken.balanceOf.call(this.proxy.address)
      ).to.be.zero;
      // Verify user balance
      expect(debtTokenUserAfter).to.be.zero;
      // (repay - borrow - interestMax) < borrowTokenUserAfter <= (repay - borrow)
      expect(
        (await balanceUser.delta()).add(new BN(receipt.receipt.gasUsed))
      ).to.be.bignumber.lte(ether('0').sub(borrowAmount));
      expect(
        (await balanceUser.delta()).add(new BN(receipt.receipt.gasUsed))
      ).to.be.bignumber.gt(
        ether('0')
          .sub(borrowAmount)
          .sub(interestMax)
      );
      profileGas(receipt);
    });

    it('should revert: not enough balance', async function() {
      const value = ether('0.5');
      const to = this.hAaveV2.address;
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
        'HAaveProtocolV2_repay: SafeERC20: low-level call failed'
      );
    });

    it('should revert: not supported token', async function() {
      const value = ether('0.5');
      const to = this.hAaveV2.address;
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
        'HAaveProtocolV2_repay: Unspecified'
      );
    });

    it('should revert: wrong rate mode', async function() {
      const value = ether('0.5');
      const to = this.hAaveV2.address;
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
        'HAaveProtocolV2_repay: 15'
      );
    });
  });

  describe('Borrow with Stable Rate', function() {
    const depositAmount = ether('10000');
    // const borrowETHAddr = WETH_TOKEN;
    const borrowTokenAddr = TUSD_TOKEN;
    const rateMode = AAVE_RATEMODE.STABLE;
    const debtTokenAddr = ATUSD_V2_DEBT_STABLE;
    const debtWETHAddr = AWETH_V2_DEBT_STABLE;

    let borrowTokenUserBefore;
    let debtTokenUserBefore;
    let debtWETHUserBefore;

    before(async function() {
      this.borrowToken = await IToken.at(borrowTokenAddr);
      this.weth = await IToken.at(WETH_TOKEN);
      this.debtWETH = await IStableDebtToken.at(debtWETHAddr);
      this.debtToken = await IStableDebtToken.at(debtTokenAddr);
    });

    beforeEach(async function() {
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
      expect(await this.aToken.balanceOf.call(user)).to.be.bignumber.eq(
        depositAmount
      );

      borrowTokenUserBefore = await this.borrowToken.balanceOf.call(user);
      borrowWETHUserBefore = await this.weth.balanceOf.call(user);
      debtTokenUserBefore = await this.debtToken.balanceOf.call(user);
      debtWETHUserBefore = await this.debtWETH.balanceOf.call(user);
    });

    it('borrow token ', async function() {
      const borrowAmount = ether('100');
      const to = this.hAaveV2.address;
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
      expect(await balanceProxy.get()).to.be.zero;
      expect(
        await this.borrowToken.balanceOf.call(this.proxy.address)
      ).to.be.zero;
      expect(
        await this.debtToken.balanceOf.call(this.proxy.address)
      ).to.be.zero;

      // Verify user balance
      expect(
        borrowTokenUserAfter.sub(borrowTokenUserBefore)
      ).to.be.bignumber.eq(borrowAmount);

      //  borrowAmount <= (debtTokenUserAfter-debtTokenUserBefore) < borrowAmount + interestMax
      const interestMax = borrowAmount.mul(new BN(1)).div(new BN(10000));
      expect(debtTokenUserAfter.sub(debtTokenUserBefore)).to.be.bignumber.gte(
        borrowAmount
      );
      expect(debtTokenUserAfter.sub(debtTokenUserBefore)).to.be.bignumber.lt(
        borrowAmount.add(interestMax)
      );
      profileGas(receipt);
    });

    it('borrow weth ', async function() {
      const borrowAmount = ether('2');
      const to = this.hAaveV2.address;
      const data = abi.simpleEncode(
        'borrow(address,uint256,uint256)',
        // this.borrowToken.address,
        WETH_TOKEN,
        borrowAmount,
        rateMode
      );

      await this.debtWETH.approveDelegation(this.proxy.address, borrowAmount, {
        from: user,
      });
      await balanceUser.get();
      const receipt = await this.proxy.execMock(to, data, {
        from: user,
        value: ether('0.1'),
      });
      const borrowWETHUserAfter = await this.weth.balanceOf.call(user);
      const debtWETHUserAfter = await this.debtWETH.balanceOf.call(user);
      // Verify proxy balance
      expect(await balanceProxy.get()).to.be.zero;
      expect(
        await this.borrowToken.balanceOf.call(this.proxy.address)
      ).to.be.zero;
      expect(
        await this.debtToken.balanceOf.call(this.proxy.address)
      ).to.be.zero;

      // Verify user balance
      expect(borrowWETHUserAfter.sub(borrowWETHUserBefore)).to.be.bignumber.eq(
        borrowAmount
      );

      //  borrowAmount <= (debtTokenUserAfter-debtTokenUserBefore) < borrowAmount + interestMax
      const interestMax = borrowAmount.mul(new BN(1)).div(new BN(10000));
      expect(debtWETHUserAfter.sub(debtWETHUserBefore)).to.be.bignumber.gte(
        borrowAmount
      );
      expect(debtWETHUserAfter.sub(debtWETHUserBefore)).to.be.bignumber.lt(
        borrowAmount.add(interestMax)
      );
      profileGas(receipt);
    });

    it('borrow eth ', async function() {
      const borrowAmount = ether('2');
      const to = this.hAaveV2.address;
      const data = abi.simpleEncode(
        'borrowETH(uint256,uint256)',
        borrowAmount,
        rateMode
      );
      await this.debtWETH.approveDelegation(this.proxy.address, borrowAmount, {
        from: user,
      });
      const balancerUserBefore = await balanceUser.get();
      const receipt = await this.proxy.execMock(to, data, {
        from: user,
        value: ether('0.1'),
      });

      const balancerUserAfter = await balanceUser.get();
      const debtWETHUserAfter = await this.debtWETH.balanceOf.call(user);
      // Verify proxy balance
      expect(await balanceProxy.get()).to.be.zero;
      expect(
        await this.borrowToken.balanceOf.call(this.proxy.address)
      ).to.be.zero;
      expect(
        await this.debtToken.balanceOf.call(this.proxy.address)
      ).to.be.zero;

      // Verify user balance
      expect(balancerUserAfter.sub(balancerUserBefore)).to.be.bignumber.eq(
        borrowAmount.sub(new BN(receipt.receipt.gasUsed))
      );
      //  borrowAmount <= (debtTokenUserAfter-debtTokenUserBefore) < borrowAmount + interestMax
      const interestMax = borrowAmount.mul(new BN(1)).div(new BN(10000));
      expect(debtWETHUserAfter.sub(debtWETHUserBefore)).to.be.bignumber.gte(
        borrowAmount
      );
      expect(debtWETHUserAfter.sub(debtWETHUserBefore)).to.be.bignumber.lt(
        borrowAmount.add(interestMax)
      );
      profileGas(receipt);
    });

    it('should revert: borrow token over the collateral value', async function() {
      const borrowAmount = ether('20000');
      const to = this.hAaveV2.address;
      const data = abi.simpleEncode(
        'borrow(address,uint256,uint256)',
        this.borrowToken.address,
        borrowAmount,
        rateMode
      );
      await this.debtWETH.approveDelegation(this.proxy.address, borrowAmount, {
        from: user,
      });

      await expectRevert(
        this.proxy.execMock(to, data, { from: user, value: ether('0.1') }),
        'HAaveProtocolV2_borrow: 11' // AAVEV2 Error Code: VL_COLLATERAL_CANNOT_COVER_NEW_BORROW
      );
    });

    it('should revert: borrow token without approveDelegation', async function() {
      const borrowAmount = ether('2');
      const to = this.hAaveV2.address;
      const data = abi.simpleEncode(
        'borrow(address,uint256,uint256)',
        this.borrowToken.address,
        borrowAmount,
        rateMode
      );

      await expectRevert(
        this.proxy.execMock(to, data, { from: user }),
        'HAaveProtocolV2_borrow: 59' // AAVEV2 Error Code: BORROW_ALLOWANCE_NOT_ENOUGH
      );
    });

    it('should revert: borrow token that is not in aaveV2 pool', async function() {
      const borrowAmount = ether('2');
      const to = this.hAaveV2.address;
      const data = abi.simpleEncode(
        'borrow(address,uint256,uint256)',
        COMP_TOKEN,
        borrowAmount,
        rateMode
      );

      await expectRevert(
        this.proxy.execMock(to, data, { from: user }),
        'HAaveProtocolV2_borrow: 2' // AAVEV2 Error Code: VL_NO_ACTIVE_RESERVE
      );
    });

    it('should revert: borrow token that is not in aaveV2 pool', async function() {
      const borrowAmount = ether('2');
      const to = this.hAaveV2.address;
      const data = abi.simpleEncode(
        'borrow(address,uint256,uint256)',
        this.borrowToken.address,
        borrowAmount,
        rateMode
      );

      await expectRevert(
        this.proxy.execMock(to, data, { from: someone }),
        'HAaveProtocolV2_borrow: 9' // AAVEV2 Error Code: VL_COLLATERAL_BALANCE_IS_0
      );
    });

    it('should revert: borrow toke is the same with collateral', async function() {
      const borrowAmount = ether('2');
      const to = this.hAaveV2.address;
      const data = abi.simpleEncode(
        'borrow(address,uint256,uint256)',
        this.token.address,
        borrowAmount,
        rateMode
      );

      await expectRevert(
        this.proxy.execMock(to, data, { from: user }),
        'HAaveProtocolV2_borrow: 13' // AAVEV2 Error Code: BORROW_ALLOWANCE_NOT_ENOUGH
      );
    });
  });

  describe('Borrow with Variable Rate', function() {
    const depositAmount = ether('10000');
    const borrowTokenAddr = TUSD_TOKEN;
    const rateMode = AAVE_RATEMODE.VARIABLE;
    const debtTokenAddr = ATUSD_V2_DEBT_VARIABLE;
    const debtWETHAddr = AWETH_V2_DEBT_VARIABLE;

    let borrowTokenUserBefore;
    let debtTokenUserBefore;
    let debtWETHUserBefore;

    before(async function() {
      this.borrowToken = await IToken.at(borrowTokenAddr);
      this.weth = await IToken.at(WETH_TOKEN);
      this.debtWETH = await IVariableDebtToken.at(debtWETHAddr);
      this.debtToken = await IVariableDebtToken.at(debtTokenAddr);
    });

    beforeEach(async function() {
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
      expect(await this.aToken.balanceOf.call(user)).to.be.bignumber.eq(
        depositAmount
      );

      borrowTokenUserBefore = await this.borrowToken.balanceOf.call(user);
      borrowWETHUserBefore = await this.weth.balanceOf.call(user);
      debtTokenUserBefore = await this.debtToken.balanceOf.call(user);
      debtWETHUserBefore = await this.debtWETH.balanceOf.call(user);
    });

    it('borrow token ', async function() {
      const borrowAmount = ether('100');
      const to = this.hAaveV2.address;
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
      expect(await balanceProxy.get()).to.be.zero;
      expect(
        await this.borrowToken.balanceOf.call(this.proxy.address)
      ).to.be.zero;
      expect(
        await this.debtToken.balanceOf.call(this.proxy.address)
      ).to.be.zero;

      // Verify user balance
      expect(
        borrowTokenUserAfter.sub(borrowTokenUserBefore)
      ).to.be.bignumber.eq(borrowAmount);

      //  borrowAmount <= (debtTokenUserAfter-debtTokenUserBefore) < borrowAmount + interestMax
      const interestMax = borrowAmount.mul(new BN(1)).div(new BN(10000));
      expect(debtTokenUserAfter.sub(debtTokenUserBefore)).to.be.bignumber.gte(
        borrowAmount
      );
      expect(debtTokenUserAfter.sub(debtTokenUserBefore)).to.be.bignumber.lt(
        borrowAmount.add(interestMax)
      );

      profileGas(receipt);
    });

    it('borrow weth ', async function() {
      const borrowAmount = ether('2');
      const to = this.hAaveV2.address;
      const data = abi.simpleEncode(
        'borrow(address,uint256,uint256)',
        WETH_TOKEN,
        borrowAmount,
        rateMode
      );

      await this.debtWETH.approveDelegation(this.proxy.address, borrowAmount, {
        from: user,
      });
      await balanceUser.get();
      const receipt = await this.proxy.execMock(to, data, {
        from: user,
        value: ether('0.1'),
      });
      const borrowWETHUserAfter = await this.weth.balanceOf.call(user);
      const debtWETHUserAfter = await this.debtWETH.balanceOf.call(user);
      // Verify proxy balance
      expect(await balanceProxy.get()).to.be.zero;
      expect(
        await this.borrowToken.balanceOf.call(this.proxy.address)
      ).to.be.zero;
      expect(
        await this.debtToken.balanceOf.call(this.proxy.address)
      ).to.be.zero;

      // Verify user balance
      expect(borrowWETHUserAfter.sub(borrowWETHUserBefore)).to.be.bignumber.eq(
        borrowAmount
      );

      //  borrowAmount <= (debtTokenUserAfter-debtTokenUserBefore) < borrowAmount + interestMax
      const interestMax = borrowAmount.mul(new BN(1)).div(new BN(10000));
      expect(debtWETHUserAfter.sub(debtWETHUserBefore)).to.be.bignumber.gte(
        borrowAmount
      );
      expect(debtWETHUserAfter.sub(debtWETHUserBefore)).to.be.bignumber.lt(
        borrowAmount.add(interestMax)
      );

      profileGas(receipt);
    });

    it('borrow eth ', async function() {
      const borrowAmount = ether('2');
      const to = this.hAaveV2.address;
      const data = abi.simpleEncode(
        'borrowETH(uint256,uint256)',
        borrowAmount,
        rateMode
      );
      await this.debtWETH.approveDelegation(this.proxy.address, borrowAmount, {
        from: user,
      });
      const balancerUserBefore = await balanceUser.get();
      const receipt = await this.proxy.execMock(to, data, {
        from: user,
        value: ether('0.1'),
      });

      const balancerUserAfter = await balanceUser.get();
      const debtWETHUserAfter = await this.debtWETH.balanceOf.call(user);
      // Verify proxy balance
      expect(await balanceProxy.get()).to.be.zero;
      expect(
        await this.borrowToken.balanceOf.call(this.proxy.address)
      ).to.be.zero;
      expect(
        await this.debtToken.balanceOf.call(this.proxy.address)
      ).to.be.zero;

      // Verify user balance
      expect(balancerUserAfter.sub(balancerUserBefore)).to.be.bignumber.eq(
        borrowAmount.sub(new BN(receipt.receipt.gasUsed))
      );

      //  borrowAmount <= (debtTokenUserAfter-debtTokenUserBefore) < borrowAmount + interestMax
      const interestMax = borrowAmount.mul(new BN(1)).div(new BN(10000));
      expect(debtWETHUserAfter.sub(debtWETHUserBefore)).to.be.bignumber.gte(
        borrowAmount
      );
      expect(debtWETHUserAfter.sub(debtWETHUserBefore)).to.be.bignumber.lt(
        borrowAmount.add(interestMax)
      );
      profileGas(receipt);
    });

    it('should revert: borrow token over the collateral value', async function() {
      const borrowAmount = ether('20000');
      const to = this.hAaveV2.address;
      const data = abi.simpleEncode(
        'borrow(address,uint256,uint256)',
        this.borrowToken.address,
        borrowAmount,
        rateMode
      );
      await this.debtWETH.approveDelegation(this.proxy.address, borrowAmount, {
        from: user,
      });

      await expectRevert(
        this.proxy.execMock(to, data, { from: user, value: ether('0.1') }),
        'HAaveProtocolV2_borrow: 11' // AAVEV2 Error Code: VL_COLLATERAL_CANNOT_COVER_NEW_BORROW
      );
    });

    it('should revert: borrow token without approveDelegation', async function() {
      const borrowAmount = ether('2');
      const to = this.hAaveV2.address;
      const data = abi.simpleEncode(
        'borrow(address,uint256,uint256)',
        this.borrowToken.address,
        borrowAmount,
        rateMode
      );

      await expectRevert(
        this.proxy.execMock(to, data, { from: user }),
        'HAaveProtocolV2_borrow: 59' // AAVEV2 Error Code: BORROW_ALLOWANCE_NOT_ENOUGH
      );
    });

    it('should revert: borrow token that is not in aaveV2 pool', async function() {
      const borrowAmount = ether('2');
      const to = this.hAaveV2.address;
      const data = abi.simpleEncode(
        'borrow(address,uint256,uint256)',
        COMP_TOKEN,
        borrowAmount,
        rateMode
      );

      await expectRevert(
        this.proxy.execMock(to, data, { from: user }),
        'HAaveProtocolV2_borrow: 2' // AAVEV2 Error Code: VL_NO_ACTIVE_RESERVE
      );
    });

    it('should revert: borrow token that is not in pool', async function() {
      const borrowAmount = ether('2');
      const to = this.hAaveV2.address;
      const data = abi.simpleEncode(
        'borrow(address,uint256,uint256)',
        this.borrowToken.address,
        borrowAmount,
        rateMode
      );

      await expectRevert(
        this.proxy.execMock(to, data, { from: someone }),
        'HAaveProtocolV2_borrow: 9' // AAVEV2 Error Code: VL_COLLATERAL_BALANCE_IS_0
      );
    });

    it('should revert: borrow toke is the same with collateral', async function() {
      const borrowAmount = ether('2');
      const to = this.hAaveV2.address;
      const data = abi.simpleEncode(
        'borrow(address,uint256,uint256)',
        this.token.address,
        borrowAmount,
        rateMode
      );

      await this.debtWETH.approveDelegation(user, borrowAmount, {
        from: user,
      });

      await expectRevert(
        this.proxy.execMock(to, data, { from: user }),
        'HAaveProtocolV2_borrow: 59' // AAVEV2 Error Code: BORROW_ALLOWANCE_NOT_ENOUGH
        // Variable rate doesn't check collateral and debt
      );
    });
  });
});
