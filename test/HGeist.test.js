const chainId = network.config.chainId;
if (chainId == 250) {
  // This test supports to run on these chains.
} else {
  return;
}

const {
  balance,
  BN,
  constants,
  ether,
  expectRevert,
  time,
} = require('@openzeppelin/test-helpers');
const { MAX_UINT256 } = constants;
const { tracker } = balance;
const abi = require('ethereumjs-abi');
const utils = web3.utils;
const { expect } = require('chai');

const {
  DAI_TOKEN,
  GEIST_LENDING_POOL_PROVIDER,
  WRAPPED_NATIVE_TOKEN,
  GWRAPPED_NATIVE_TOKEN,
} = require('./utils/constants');

const {
  evmRevert,
  evmSnapshot,
  profileGas,
  getHandlerReturn,
  mulPercent,
  expectEqWithinBps,
  getTokenProvider,
} = require('./utils/utils');

const HGeist = artifacts.require('HGeist');
const FeeRuleRegistry = artifacts.require('FeeRuleRegistry');
const Registry = artifacts.require('Registry');
const Proxy = artifacts.require('ProxyMock');
const IToken = artifacts.require('IERC20');
const IGToken = artifacts.require('IATokenV2');
const ILendingPool = artifacts.require('ILendingPoolV2');
const IProvider = artifacts.require('ILendingPoolAddressesProviderV2');
const SimpleToken = artifacts.require('SimpleToken');

contract('Geist', function ([_, user]) {
  const tokenAddress = DAI_TOKEN;
  const gWrappedNativeTokenAddress = GWRAPPED_NATIVE_TOKEN;
  const wrappedNativeTokenAddress = WRAPPED_NATIVE_TOKEN;
  const GTOKEN_DUST = ether('0.00001');

  let id;
  let balanceUser;
  let balanceProxy;
  let providerAddress;
  let wethProviderAddress;

  before(async function () {
    providerAddress = await getTokenProvider(tokenAddress);
    wethProviderAddress = await getTokenProvider(wrappedNativeTokenAddress);

    this.registry = await Registry.new();
    this.feeRuleRegistry = await FeeRuleRegistry.new('0', _);
    this.proxy = await Proxy.new(
      this.registry.address,
      this.feeRuleRegistry.address
    );
    this.hGeist = await HGeist.new(
      WRAPPED_NATIVE_TOKEN,
      GEIST_LENDING_POOL_PROVIDER
    );
    await this.registry.register(
      this.hGeist.address,
      utils.asciiToHex('Geist')
    );
    this.provider = await IProvider.at(GEIST_LENDING_POOL_PROVIDER);
    this.lendingPoolAddress = await this.provider.getLendingPool.call();
    this.lendingPool = await ILendingPool.at(this.lendingPoolAddress);
    this.token = await IToken.at(tokenAddress);
    this.gToken = await IGToken.at(
      (
        await this.lendingPool.getReserveData.call(tokenAddress)
      ).aTokenAddress
    );
    this.wrappedNativeToken = await IToken.at(wrappedNativeTokenAddress);
    this.gWrappedNativeToken = await IGToken.at(gWrappedNativeTokenAddress);
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

  describe('Deposit', function () {
    describe('Ether', function () {
      it('normal', async function () {
        const value = ether('10');
        const to = this.hGeist.address;
        const data = abi.simpleEncode('depositETH(uint256)', value);

        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: value,
        });
        expect(await balanceProxy.get()).to.be.bignumber.zero;
        expect(
          await this.gWrappedNativeToken.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.zero;
        expectEqWithinBps(
          await this.gWrappedNativeToken.balanceOf.call(user),
          value,
          100
        );
        expect(await balanceUser.delta()).to.be.bignumber.eq(
          ether('0').sub(value)
        );
        profileGas(receipt);
      });

      it('max amount', async function () {
        const value = ether('10');
        const to = this.hGeist.address;
        const data = abi.simpleEncode('depositETH(uint256)', MAX_UINT256);

        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: value,
        });
        expect(await balanceProxy.get()).to.be.bignumber.zero;
        expect(
          await this.gWrappedNativeToken.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.zero;
        expectEqWithinBps(
          await this.gWrappedNativeToken.balanceOf.call(user),
          value,
          100
        );
        expect(await balanceUser.delta()).to.be.bignumber.eq(
          ether('0').sub(value)
        );
        profileGas(receipt);
      });
    });

    describe('Token', function () {
      it('normal', async function () {
        const value = ether('10');
        const to = this.hGeist.address;
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
        expect(await balanceProxy.get()).to.be.bignumber.zero;
        expect(
          await this.gToken.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.zero;
        expectEqWithinBps(await this.gToken.balanceOf.call(user), value, 100);
        expect(await balanceUser.delta()).to.be.bignumber.eq(ether('0'));
        profileGas(receipt);
      });

      it('max amount', async function () {
        const value = ether('10');
        const to = this.hGeist.address;
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
        expect(await balanceProxy.get()).to.be.bignumber.zero;
        expect(
          await this.gToken.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.zero;
        expectEqWithinBps(await this.gToken.balanceOf.call(user), value, 100);

        expect(await balanceUser.delta()).to.be.bignumber.eq(ether('0'));
        profileGas(receipt);
      });

      it('should revert: not supported token', async function () {
        const value = ether('10');
        const to = this.hGeist.address;
        const data = abi.simpleEncode(
          'deposit(address,uint256)',
          this.mockToken.address,
          value
        );
        await this.mockToken.transfer(this.proxy.address, value, { from: _ });
        await expectRevert(
          this.proxy.execMock(to, data, { from: user }),
          'HGeist_General: gToken should not be zero address'
        );
      });
    });
  });

  describe('Withdraw', function () {
    var depositAmount = ether('5');

    describe('Ether', function () {
      beforeEach(async function () {
        await this.wrappedNativeToken.approve(
          this.lendingPool.address,
          depositAmount,
          {
            from: wethProviderAddress,
          }
        );
        await this.lendingPool.deposit(
          this.wrappedNativeToken.address,
          depositAmount,
          user,
          0,
          { from: wethProviderAddress }
        );

        depositAmount = await this.gWrappedNativeToken.balanceOf.call(user);
      });

      it('partial', async function () {
        const value = depositAmount.div(new BN(2));
        const to = this.hGeist.address;
        const data = abi.simpleEncode('withdrawETH(uint256)', value);
        await this.gWrappedNativeToken.transfer(this.proxy.address, value, {
          from: user,
        });
        await this.proxy.updateTokenMock(this.gWrappedNativeToken.address);
        await balanceUser.get();

        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: ether('0.1'),
        });

        // Get handler return result
        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );
        const gTokenUserAfter = await this.gWrappedNativeToken.balanceOf.call(
          user
        );
        const interestMax = depositAmount.mul(new BN(1)).div(new BN(10000));

        // Verify handler return
        expect(value).to.be.bignumber.eq(handlerReturn);
        // Verify proxy balance
        expect(
          await this.gWrappedNativeToken.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.zero;
        // Verify user balance
        // (deposit - withdraw - 1) <= gTokenAfter < (deposit + interestMax - withdraw)
        expect(gTokenUserAfter).to.be.bignumber.gte(
          depositAmount.sub(value).sub(new BN(1))
        );
        expect(gTokenUserAfter).to.be.bignumber.lt(
          depositAmount.add(interestMax).sub(value)
        );
        expect(await balanceUser.delta()).to.be.bignumber.eq(value);
        profileGas(receipt);
      });

      it('max amount', async function () {
        const value = depositAmount.div(new BN(2));
        const to = this.hGeist.address;
        const data = abi.simpleEncode('withdrawETH(uint256)', MAX_UINT256);
        await this.gWrappedNativeToken.transfer(this.proxy.address, value, {
          from: user,
        });
        await this.proxy.updateTokenMock(this.gWrappedNativeToken.address);
        await balanceUser.get();

        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: ether('0.1'),
        });

        // Get handler return result
        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );
        const gTokenUserAfter = await this.gWrappedNativeToken.balanceOf.call(
          user
        );
        const interestMax = depositAmount.mul(new BN(1)).div(new BN(10000));

        // Verify handler return
        // value  <= handlerReturn  <= value*1.01
        // Because GToken could be increase by timestamp in proxy
        expect(value).to.be.bignumber.lte(handlerReturn);
        expect(mulPercent(value, 101)).to.be.bignumber.gte(handlerReturn);

        // Verify proxy balance
        expect(
          await this.gWrappedNativeToken.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.zero;
        // Verify user balance
        // (deposit - withdraw) <= gTokenAfter < (deposit + interestMax - withdraw)
        // NOTE: gTokenUserAfter == (depositAmount - withdraw - 1) (sometime, Ganache bug maybe)
        expect(gTokenUserAfter).to.be.bignumber.gte(
          depositAmount.sub(handlerReturn.add(new BN(1)))
        );
        expect(gTokenUserAfter).to.be.bignumber.lt(
          depositAmount.add(interestMax).sub(handlerReturn)
        );
        expectEqWithinBps(await balanceUser.delta(), value, 100);

        profileGas(receipt);
      });
    });

    describe('Token', function () {
      beforeEach(async function () {
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
      });

      it('partial', async function () {
        const value = depositAmount.div(new BN(2));
        const to = this.hGeist.address;
        const data = abi.simpleEncode(
          'withdraw(address,uint256)',
          this.token.address,
          value
        );

        await this.gToken.transfer(this.proxy.address, value, { from: user });
        await this.proxy.updateTokenMock(this.gToken.address);
        await balanceUser.get();
        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: ether('0.1'),
        });

        // Get handler return result
        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );
        const gTokenUserAfter = await this.gToken.balanceOf.call(user);
        const tokenUserAfter = await this.token.balanceOf.call(user);
        const interestMax = depositAmount.mul(new BN(1)).div(new BN(10000));

        // Verify handler return
        expect(value).to.be.bignumber.eq(handlerReturn);
        // Verify proxy balance
        expect(
          await this.gToken.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.zero;
        expect(
          await this.token.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.zero;

        // Verify user balance
        // (deposit - withdraw - 1) <= gTokenAfter < (deposit + interestMax - withdraw)
        expect(gTokenUserAfter).to.be.bignumber.gte(
          depositAmount.sub(value).sub(new BN(1))
        );
        expect(gTokenUserAfter).to.be.bignumber.lt(
          depositAmount.add(interestMax).sub(value)
        );
        expect(tokenUserAfter).to.be.bignumber.eq(value);
        expect(await balanceUser.delta()).to.be.bignumber.eq(ether('0'));
        profileGas(receipt);
      });

      it('max amount', async function () {
        const value = depositAmount.div(new BN(2));
        const to = this.hGeist.address;
        const data = abi.simpleEncode(
          'withdraw(address,uint256)',
          this.token.address,
          MAX_UINT256
        );
        await this.gToken.transfer(this.proxy.address, value, { from: user });
        await this.proxy.updateTokenMock(this.gToken.address);
        await balanceUser.get();

        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: ether('0.1'),
        });

        // Get handler return result
        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );
        const gTokenUserAfter = await this.gToken.balanceOf.call(user);
        const tokenUserAfter = await this.token.balanceOf.call(user);
        const interestMax = depositAmount.mul(new BN(1)).div(new BN(10000));

        // Verify handler return
        // value  <= handlerReturn  <= value*1.01
        // Because GToken could be increase by timestamp in proxy
        expect(value).to.be.bignumber.lte(handlerReturn);
        expect(mulPercent(value, 101)).to.be.bignumber.gte(handlerReturn);

        // Verify proxy balance
        expect(
          await this.gToken.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.zero;
        expect(
          await this.token.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.zero;
        // Verify user balance
        // (deposit - withdraw -1) <= gTokenAfter < (deposit + interestMax - withdraw)
        // NOTE: gTokenUserAfter == (depositAmount - withdraw - 1) (sometime, Ganache bug maybe)
        expect(gTokenUserAfter).to.be.bignumber.gte(
          depositAmount.sub(handlerReturn.add(new BN(1)))
        );
        expect(gTokenUserAfter).to.be.bignumber.lt(
          depositAmount.add(interestMax).sub(handlerReturn)
        );
        expect(tokenUserAfter).to.be.bignumber.eq(handlerReturn);
        expect(await balanceUser.delta()).to.be.bignumber.eq(ether('0'));
        profileGas(receipt);
      });

      it('whole', async function () {
        const value = MAX_UINT256;
        const to = this.hGeist.address;
        const data = abi.simpleEncode(
          'withdraw(address,uint256)',
          this.token.address,
          value
        );
        await this.gToken.transfer(
          this.proxy.address,
          await this.gToken.balanceOf.call(user),
          { from: user }
        );
        await this.proxy.updateTokenMock(this.gToken.address);
        await balanceUser.get();

        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: ether('0.1'),
        });

        // Get handler return result
        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );
        const gTokenUserAfter = await this.gToken.balanceOf.call(user);
        const tokenUserAfter = await this.token.balanceOf.call(user);

        // Verify handler return
        expect(handlerReturn).to.be.bignumber.gte(depositAmount);
        // Verify proxy balance
        expect(
          await this.gToken.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.zero;
        expect(
          await this.token.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.zero;
        // Verify user balance
        expect(gTokenUserAfter).to.be.bignumber.lt(GTOKEN_DUST);
        expect(tokenUserAfter).to.be.bignumber.eq(handlerReturn);
        expect(await balanceUser.delta()).to.be.bignumber.eq(ether('0'));
        profileGas(receipt);
      });

      it('should revert: not enough balance', async function () {
        const value = depositAmount.add(ether('10'));
        const to = this.hGeist.address;
        const data = abi.simpleEncode(
          'withdraw(address,uint256)',
          this.token.address,
          value
        );

        await this.gToken.transfer(
          this.proxy.address,
          await this.gToken.balanceOf.call(user),
          { from: user }
        );
        await this.proxy.updateTokenMock(this.gToken.address);

        await expectRevert(
          this.proxy.execMock(to, data, { from: user }),
          'HGeist_withdraw: 5'
        );
      });

      it('should revert: not supported token', async function () {
        const value = depositAmount.add(ether('10'));
        const to = this.hGeist.address;
        const data = abi.simpleEncode(
          'withdraw(address,uint256)',
          this.mockToken.address,
          value
        );

        await expectRevert(
          this.proxy.execMock(to, data, { from: user }),
          'HGeist_General: gToken should not be zero address'
        );
      });
    });
  });
});
