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
const { latest } = time;
const abi = require('ethereumjs-abi');
const utils = web3.utils;

const { expect } = require('chai');

const {
  DAI_TOKEN,
  DAI_PROVIDER,
  BAT_TOKEN,
  BAT_PROVIDER,
  USDT_TOKEN,
  USDT_PROVIDER,
} = require('./utils/constants');
const { evmRevert, evmSnapshot, profileGas } = require('./utils/utils');

const HERC20TokenIn = artifacts.require('OldHERC20TokenIn');
const Registry = artifacts.require('Registry');
const Proxy = artifacts.require('ProxyMock');
const IToken = artifacts.require('IERC20');
const IUsdt = artifacts.require('IERC20Usdt');

contract('Old ERC20TokenIn', function([_, user]) {
  const tokenAddresses = [DAI_TOKEN, BAT_TOKEN];
  const providerAddresses = [DAI_PROVIDER, BAT_PROVIDER];
  let id;

  before(async function() {
    this.registry = await Registry.new();
    this.proxy = await Proxy.new(this.registry.address);
    this.hERC20TokenIn = await HERC20TokenIn.new();
    await this.registry.register(
      this.hERC20TokenIn.address,
      utils.asciiToHex('ERC20In')
    );
  });

  beforeEach(async function() {
    id = await evmSnapshot();
  });

  afterEach(async function() {
    await evmRevert(id);
  });

  describe('single token', function() {
    before(async function() {
      this.token0 = await IToken.at(tokenAddresses[0]);
      this.usdt = await IUsdt.at(USDT_TOKEN);
    });

    it('normal', async function() {
      const token = [this.token0.address];
      const value = [ether('100')];
      const to = this.hERC20TokenIn.address;
      const data = abi.simpleEncode(
        'inject(address[],uint256[])',
        token,
        value
      );
      await this.token0.transfer(user, value[0], {
        from: providerAddresses[0],
      });
      await this.token0.approve(this.proxy.address, value[0], { from: user });

      const receipt = await this.proxy.execMock(to, data, { from: user });

      await expectEvent.inTransaction(receipt.tx, this.token0, 'Transfer', {
        from: user,
        to: this.proxy.address,
        value: value[0],
      });
      await expectEvent.inTransaction(receipt.tx, this.token0, 'Transfer', {
        from: this.proxy.address,
        to: user,
        value: value[0],
      });
      profileGas(receipt);
    });

    it('USDT', async function() {
      const token = [this.usdt.address];
      const value = [new BN('1000000')];
      const to = this.hERC20TokenIn.address;
      const data = abi.simpleEncode(
        'inject(address[],uint256[])',
        token,
        value
      );
      await this.usdt.transfer(user, value[0], {
        from: USDT_PROVIDER,
      });
      await this.usdt.approve(this.proxy.address, value[0], { from: user });

      const receipt = await this.proxy.execMock(to, data, { from: user });

      await expectEvent.inTransaction(receipt.tx, this.usdt, 'Transfer', {
        from: user,
        to: this.proxy.address,
        value: value[0],
      });
      await expectEvent.inTransaction(receipt.tx, this.usdt, 'Transfer', {
        from: this.proxy.address,
        to: user,
        value: value[0],
      });
      profileGas(receipt);
    });
  });

  describe('multiple tokens', function() {
    before(async function() {
      this.token0 = await IToken.at(tokenAddresses[0]);
      this.token1 = await IToken.at(tokenAddresses[1]);
    });
    it('normal', async function() {
      const token = [this.token0.address, this.token1.address];
      const value = [ether('100'), ether('100')];
      const to = this.hERC20TokenIn.address;
      const data = abi.simpleEncode(
        'inject(address[],uint256[])',
        token,
        value
      );
      await this.token0.transfer(user, value[0], {
        from: providerAddresses[0],
      });
      await this.token0.approve(this.proxy.address, value[0], { from: user });
      await this.token1.transfer(user, value[1], {
        from: providerAddresses[1],
      });
      await this.token1.approve(this.proxy.address, value[1], { from: user });

      const receipt = await this.proxy.execMock(to, data, {
        from: user,
        value: ether('1'),
      });

      await expectEvent.inTransaction(receipt.tx, this.token0, 'Transfer', {
        from: user,
        to: this.proxy.address,
        value: value[0],
      });
      await expectEvent.inTransaction(receipt.tx, this.token0, 'Transfer', {
        from: this.proxy.address,
        to: user,
        value: value[0],
      });

      await expectEvent.inTransaction(receipt.tx, this.token1, 'Transfer', {
        from: user,
        to: this.proxy.address,
        value: value[1],
      });
      await expectEvent.inTransaction(receipt.tx, this.token1, 'Transfer', {
        from: this.proxy.address,
        to: user,
        value: value[1],
      });
      profileGas(receipt);
    });
  });
});
