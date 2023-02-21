const chainId = network.config.chainId;

if (
  chainId == 1 ||
  chainId == 10 ||
  chainId == 137 ||
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
  constants,
  ether,
  expectRevert,
} = require('@openzeppelin/test-helpers');
const { MAX_UINT256 } = constants;
const { tracker } = balance;
const abi = require('ethereumjs-abi');
const utils = web3.utils;

const { expect } = require('chai');

const {
  DAI_TOKEN,
  ADAI_V3_TOKEN,
  WRAPPED_NATIVE_TOKEN,
  AAVEPROTOCOL_V3_PROVIDER,
  AWRAPPED_NATIVE_V3_TOKEN,
} = require('./utils/constants');
const {
  evmRevert,
  evmSnapshot,
  profileGas,
  getHandlerReturn,
  expectEqWithinBps,
  getTokenProvider,
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
const ATOKEN_DUST = ether('0.00001');

contract('Aave V3', function ([_, user]) {
  const aTokenAddress = ADAI_V3_TOKEN;
  const tokenAddress = DAI_TOKEN;
  const aWrappedNativeTokenAddress = AWRAPPED_NATIVE_V3_TOKEN;

  let id;
  let balanceUser;
  let balanceProxy;
  let providerAddress;
  let wrappedNativeTokenProviderAddress;

  before(async function () {
    providerAddress = await getTokenProvider(tokenAddress);
    wrappedNativeTokenProviderAddress = await getTokenProvider(
      WRAPPED_NATIVE_TOKEN
    );

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
    this.aWrappedNativeToken = await IAToken.at(aWrappedNativeTokenAddress);
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

  describe('Supply', function () {
    describe('Eth', function () {
      if (chainId == 42161) {
        // Reach AAVE V3 ETH supply cap on Arbitrum
        return;
      }
      it('normal', async function () {
        const value = ether('1');
        const to = this.hAaveV3.address;
        const data = abi.simpleEncode('supplyETH(uint256)', value);

        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: value,
        });
        expect(await balanceProxy.get()).to.be.bignumber.zero;
        expect(
          await this.aWrappedNativeToken.balanceOf(this.proxy.address)
        ).to.be.bignumber.zero;
        expectEqWithinBps(
          await this.aWrappedNativeToken.balanceOf(user),
          value,
          1
        );
        expect(await balanceUser.delta()).to.be.bignumber.eq(
          ether('0').sub(value)
        );
        profileGas(receipt);
      });

      it('max amount', async function () {
        const value = ether('1');
        const to = this.hAaveV3.address;
        const data = abi.simpleEncode('supplyETH(uint256)', MAX_UINT256);

        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: value,
        });
        expect(await balanceProxy.get()).to.be.bignumber.zero;
        expect(
          await this.aWrappedNativeToken.balanceOf(this.proxy.address)
        ).to.be.bignumber.zero;
        expectEqWithinBps(
          await this.aWrappedNativeToken.balanceOf(user),
          value,
          1
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
        const to = this.hAaveV3.address;
        const data = abi.simpleEncode(
          'supply(address,uint256)',
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
          await this.aToken.balanceOf(this.proxy.address)
        ).to.be.bignumber.zero;
        expectEqWithinBps(await this.aToken.balanceOf(user), value, 1);
        expect(await balanceUser.delta()).to.be.bignumber.eq(ether('0'));
        profileGas(receipt);
      });

      it('max amount', async function () {
        const value = ether('10');
        const to = this.hAaveV3.address;
        const data = abi.simpleEncode(
          'supply(address,uint256)',
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
          await this.aToken.balanceOf(this.proxy.address)
        ).to.be.bignumber.zero;
        expectEqWithinBps(await this.aToken.balanceOf(user), value, 1);
        expect(await balanceUser.delta()).to.be.bignumber.eq(ether('0'));
        profileGas(receipt);
      });

      it('should revert: not supported token', async function () {
        const value = ether('10');
        const to = this.hAaveV3.address;
        const data = abi.simpleEncode(
          'supply(address,uint256)',
          this.mockToken.address,
          value
        );
        await this.mockToken.transfer(this.proxy.address, value, { from: _ });
        await expectRevert(
          this.proxy.execMock(to, data, { from: user }),
          'HAaveProtocolV3_General: aToken should not be zero address'
        );
      });
    });
  });

  describe('Withdraw', function () {
    var supplyAmount = ether('1');

    describe('Eth', function () {
      if (chainId == 42161) {
        // Reach AAVE V3 ETH supply cap on Arbitrum
        return;
      }
      beforeEach(async function () {
        await this.wrappedNativeToken.approve(this.pool.address, supplyAmount, {
          from: wrappedNativeTokenProviderAddress,
        });
        await this.pool.supply(
          this.wrappedNativeToken.address,
          supplyAmount,
          user,
          0,
          {
            from: wrappedNativeTokenProviderAddress,
          }
        );

        supplyAmount = await this.aWrappedNativeToken.balanceOf(user);
      });

      it('partial', async function () {
        const value = supplyAmount.div(new BN(2));
        const to = this.hAaveV3.address;
        const data = abi.simpleEncode('withdrawETH(uint256)', value);
        await this.aWrappedNativeToken.transfer(this.proxy.address, value, {
          from: user,
        });
        await this.proxy.updateTokenMock(this.aWrappedNativeToken.address);
        await balanceUser.get();

        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: ether('0.1'),
        });

        // Get handler return result
        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );

        // Verify handler return
        expect(value).to.be.bignumber.eq(handlerReturn);

        // Verify proxy balance
        expect(
          await this.aWrappedNativeToken.balanceOf(this.proxy.address)
        ).to.be.bignumber.zero;

        // Verify user balance
        expectEqWithinBps(
          await this.aWrappedNativeToken.balanceOf(user),
          supplyAmount.sub(value),
          1
        );
        expect(await balanceUser.delta()).to.be.bignumber.eq(value);
        profileGas(receipt);
      });

      it('max amount', async function () {
        const value = supplyAmount.div(new BN(2));
        const to = this.hAaveV3.address;
        const data = abi.simpleEncode('withdrawETH(uint256)', MAX_UINT256);
        await this.aWrappedNativeToken.transfer(this.proxy.address, value, {
          from: user,
        });
        await this.proxy.updateTokenMock(this.aWrappedNativeToken.address);
        await balanceUser.get();

        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: ether('0.1'),
        });

        // Get handler return result
        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );

        // Verify handler return
        expectEqWithinBps(handlerReturn, value, 1);

        // Verify proxy balance
        expect(
          await this.aWrappedNativeToken.balanceOf(this.proxy.address)
        ).to.be.bignumber.zero;

        // Verify user balance
        expectEqWithinBps(
          await this.aWrappedNativeToken.balanceOf(user),
          supplyAmount.sub(handlerReturn),
          1
        );
        expectEqWithinBps(await balanceUser.delta(), value, 1);
        profileGas(receipt);
      });
    });

    describe('Token', function () {
      beforeEach(async function () {
        await this.token.approve(this.pool.address, supplyAmount, {
          from: providerAddress,
        });
        await this.pool.supply(this.token.address, supplyAmount, user, 0, {
          from: providerAddress,
        });

        supplyAmount = await this.aToken.balanceOf(user);
      });

      it('partial', async function () {
        const value = supplyAmount.div(new BN(2));
        const to = this.hAaveV3.address;
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

        // Verify handler return
        expect(value).to.be.bignumber.eq(handlerReturn);
        // Verify proxy balance
        expect(
          await this.aToken.balanceOf(this.proxy.address)
        ).to.be.bignumber.zero;
        expect(
          await this.token.balanceOf(this.proxy.address)
        ).to.be.bignumber.zero;

        // Verify user balance
        expectEqWithinBps(
          await this.aToken.balanceOf(user),
          supplyAmount.sub(value),
          1
        );
        expect(await this.token.balanceOf(user)).to.be.bignumber.eq(value);
        expect(await balanceUser.delta()).to.be.bignumber.eq(ether('0'));
        profileGas(receipt);
      });

      it('max amount', async function () {
        const value = supplyAmount.div(new BN(2));
        const to = this.hAaveV3.address;
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

        // Verify handler return
        // Because AToken could be increase by timestamp in proxy
        expectEqWithinBps(handlerReturn, value, 1);

        // Verify proxy balance
        expect(
          await this.aToken.balanceOf(this.proxy.address)
        ).to.be.bignumber.zero;
        expect(
          await this.token.balanceOf(this.proxy.address)
        ).to.be.bignumber.zero;

        // Verify user balance
        expectEqWithinBps(
          await this.aToken.balanceOf(user),
          supplyAmount.sub(handlerReturn),
          1
        );
        expect(await this.token.balanceOf(user)).to.be.bignumber.eq(
          handlerReturn
        );
        expect(await balanceUser.delta()).to.be.bignumber.eq(ether('0'));
        profileGas(receipt);
      });

      it('whole', async function () {
        const value = MAX_UINT256;
        const to = this.hAaveV3.address;
        const data = abi.simpleEncode(
          'withdraw(address,uint256)',
          this.token.address,
          value
        );
        await this.aToken.transfer(
          this.proxy.address,
          await this.aToken.balanceOf(user),
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
        const aTokenUserAfter = await this.aToken.balanceOf(user);
        const tokenUserAfter = await this.token.balanceOf(user);

        // Verify handler return
        expect(handlerReturn).to.be.bignumber.gte(supplyAmount);

        // Verify proxy balance
        expect(
          await this.aToken.balanceOf(this.proxy.address)
        ).to.be.bignumber.zero;
        expect(
          await this.token.balanceOf(this.proxy.address)
        ).to.be.bignumber.zero;

        // Verify user balance
        expect(aTokenUserAfter).to.be.bignumber.lt(ATOKEN_DUST);
        expect(tokenUserAfter).to.be.bignumber.eq(handlerReturn);
        expect(await balanceUser.delta()).to.be.bignumber.eq(ether('0'));
        profileGas(receipt);
      });

      it('should revert: not enough balance', async function () {
        const value = supplyAmount.add(ether('10'));
        const to = this.hAaveV3.address;
        const data = abi.simpleEncode(
          'withdraw(address,uint256)',
          this.token.address,
          value
        );

        await this.aToken.transfer(
          this.proxy.address,
          await this.aToken.balanceOf(user),
          { from: user }
        );
        await this.proxy.updateTokenMock(this.aToken.address);

        await expectRevert(
          this.proxy.execMock(to, data, { from: user }),
          'HAaveProtocolV3_withdraw: 32' // AAVEV3 Error Code: NOT_ENOUGH_AVAILABLE_USER_BALANCE
        );
      });

      it('should revert: not supported token', async function () {
        const value = supplyAmount.add(ether('10'));
        const to = this.hAaveV3.address;
        const data = abi.simpleEncode(
          'withdraw(address,uint256)',
          this.mockToken.address,
          value
        );

        await expectRevert(
          this.proxy.execMock(to, data, { from: user }),
          'HAaveProtocolV3_General: aToken should not be zero address'
        );
      });
    });
  });
});
