const chainId = network.config.chainId;

if (chainId == 1 || chainId == 10 || chainId == 42161 || chainId == 43114) {
  // This test supports to run on these chains.
} else {
  return;
}

const { balance, BN, ether } = require('@openzeppelin/test-helpers');
const { tracker } = balance;
const abi = require('ethereumjs-abi');
const utils = web3.utils;

const { expect } = require('chai');

const { WRAPPED_NATIVE_TOKEN } = require('./utils/constants');
const {
  evmRevert,
  evmSnapshot,
  profileGas,
  getTokenProvider,
} = require('./utils/utils');

const HWrappedNativeToken = artifacts.require('HWrappedNativeToken');
const FeeRuleRegistry = artifacts.require('FeeRuleRegistry');
const Registry = artifacts.require('Registry');
const Proxy = artifacts.require('ProxyMock');
const IToken = artifacts.require('IERC20');

contract('WrappedNativeToken', function([_, user]) {
  const wrappedNativeToken = WRAPPED_NATIVE_TOKEN;

  let id;
  let tokenProviderAddress;

  before(async function() {
    tokenProviderAddress = await getTokenProvider(wrappedNativeToken);

    this.token = await IToken.at(wrappedNativeToken);
    this.registry = await Registry.new();
    this.feeRuleRegistry = await FeeRuleRegistry.new('0', _);
    this.proxy = await Proxy.new(
      this.registry.address,
      this.feeRuleRegistry.address
    );
    this.hWrappedNativeToken = await HWrappedNativeToken.new(
      wrappedNativeToken
    );
    await this.registry.register(
      this.hWrappedNativeToken.address,
      utils.asciiToHex('WrappedNativeToken')
    );
  });

  beforeEach(async function() {
    id = await evmSnapshot();
  });

  afterEach(async function() {
    await evmRevert(id);
  });

  describe('deposit', function() {
    beforeEach(async function() {
      tokenUserAmount = await this.token.balanceOf.call(user);
      balanceProxy = await tracker(this.proxy.address);
      balanceUser = await tracker(user);
    });

    it('normal', async function() {
      // Prepare handler data
      const token = this.token.address;
      const value = ether('10');
      const to = this.hWrappedNativeToken.address;
      const data = abi.simpleEncode('deposit(uint256)', value);

      // Send tokens to proxy
      const receipt = await this.proxy.execMock(to, data, {
        from: user,
        value: value,
      });

      // Verify proxy balance should be zero
      expect(await balanceProxy.get()).to.be.bignumber.eq(ether('0'));
      expect(
        await this.token.balanceOf.call(this.proxy.address)
      ).to.be.bignumber.eq(ether('0'));

      // Verify user balance
      expect(await this.token.balanceOf.call(user)).to.be.bignumber.eq(
        tokenUserAmount.add(value)
      );
      expect(await balanceUser.delta()).to.be.bignumber.eq(
        ether('0').sub(value)
      );

      profileGas(receipt);
    });
  });

  describe('withdraw', function() {
    beforeEach(async function() {
      this.token = await IToken.at(wrappedNativeToken);
      tokenUserAmount = await this.token.balanceOf.call(user);
      balanceProxy = await tracker(this.proxy.address);
      balanceUser = await tracker(user);
    });

    it('normal', async function() {
      // Prepare handler data
      const token = this.token.address;
      const value = ether('10');
      const to = this.hWrappedNativeToken.address;
      const data = abi.simpleEncode('withdraw(uint256)', value);

      // Send WETH to proxy and prepare handler data
      await this.token.transfer(this.proxy.address, value, {
        from: tokenProviderAddress,
      });
      await this.proxy.updateTokenMock(this.token.address);

      // Send tokens to proxy
      const receipt = await this.proxy.execMock(to, data, {
        from: user,
        value: value,
      });

      // Verify proxy balance should be zero
      expect(await balanceProxy.get()).to.be.bignumber.eq(ether('0'));
      expect(
        await this.token.balanceOf.call(this.proxy.address)
      ).to.be.bignumber.eq(ether('0'));

      // Verify user balance
      expect(await this.token.balanceOf.call(user)).to.be.bignumber.eq(
        tokenUserAmount
      );
      expect(await balanceUser.delta()).to.be.bignumber.eq(value);

      profileGas(receipt);
    });
  });
});
