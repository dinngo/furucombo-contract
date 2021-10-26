const { balance, BN, ether } = require('@openzeppelin/test-helpers');
const { tracker } = balance;
const abi = require('ethereumjs-abi');
const utils = web3.utils;

const { expect } = require('chai');

const { WETH_TOKEN } = require('./utils/constants');
const {
  evmRevert,
  evmSnapshot,
  profileGas,
  tokenProviderUniV2,
} = require('./utils/utils');

const HWeth = artifacts.require('HWeth');
const Registry = artifacts.require('Registry');
const Proxy = artifacts.require('ProxyMock');
const IToken = artifacts.require('IERC20');

contract('Weth', function([_, user]) {
  const tokenAddress = WETH_TOKEN;

  let id;
  let tokenProviderAddress;

  before(async function() {
    tokenProviderAddress = await tokenProviderUniV2(tokenAddress);

    this.token = await IToken.at(tokenAddress);
    this.registry = await Registry.new();
    this.proxy = await Proxy.new(this.registry.address);
    this.hWeth = await HWeth.new();
    await this.registry.register(this.hWeth.address, utils.asciiToHex('Weth'));
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
      const to = this.hWeth.address;
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
        ether('0')
          .sub(value)
          .sub(new BN(receipt.receipt.gasUsed))
      );

      profileGas(receipt);
    });
  });

  describe('withdraw', function() {
    beforeEach(async function() {
      this.token = await IToken.at(tokenAddress);
      tokenUserAmount = await this.token.balanceOf.call(user);
      balanceProxy = await tracker(this.proxy.address);
      balanceUser = await tracker(user);
    });

    it('normal', async function() {
      // Prepare handler data
      const token = this.token.address;
      const value = ether('10');
      const to = this.hWeth.address;
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
      expect(await balanceUser.delta()).to.be.bignumber.eq(
        value.sub(new BN(receipt.receipt.gasUsed))
      );

      profileGas(receipt);
    });
  });
});
