const {
  balance,
  BN,
  constants,
  ether,
  expectEvent,
  expectRevert,
  time,
} = require('@openzeppelin/test-helpers');
const {tracker} = balance;
const {latest} = time;
const abi = require('ethereumjs-abi');
const utils = web3.utils;

const {expect} = require('chai');

const {
  DAI_TOKEN,
  DAI_PROVIDER,
  BAT_TOKEN,
  BAT_PROVIDER,
} = require('./utils/constants');
const {resetAccount, profileGas} = require('./utils/utils');

const HERC20TokenIn = artifacts.require('HERC20TokenIn');
const Registry = artifacts.require('Registry');
const Proxy = artifacts.require('ProxyMock');
const IToken = artifacts.require('IERC20');

contract('ERC20TokenIn', function([_, deployer, user, someone]) {
  const tokenAddresses = [DAI_TOKEN, BAT_TOKEN];
  const providerAddresses = [DAI_PROVIDER, BAT_PROVIDER];

  before(async function() {
    this.registry = await Registry.new();
    this.proxy = await Proxy.new(this.registry.address);
    this.herc20tokenin = await HERC20TokenIn.new();
    await this.registry.register(
      this.herc20tokenin.address,
      utils.asciiToHex('ERC20In')
    );
  });

  beforeEach(async function() {
    await resetAccount(_);
    await resetAccount(user);
  });

  describe('single token', function() {
    before(async function() {
      this.token0 = await IToken.at(tokenAddresses[0]);
    });
    it('normal', async function() {
      const token = [this.token0.address];
      const value = [ether('100')];
      const to = this.herc20tokenin.address;
      const data = abi.simpleEncode(
        'inject(address[],uint256[])',
        token,
        value
      );
      await this.token0.transfer(user, value[0], {
        from: providerAddresses[0],
      });
      await this.token0.approve(this.proxy.address, value[0], {from: user});

      const receipt = await this.proxy.execMock(to, data, {from: user});

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
  });

  describe('multiple tokens', function() {
    before(async function() {
      this.token0 = await IToken.at(tokenAddresses[0]);
      this.token1 = await IToken.at(tokenAddresses[1]);
    });
    it('normal', async function() {
      const token = [this.token0.address, this.token1.address];
      const value = [ether('100'), ether('100')];
      const to = this.herc20tokenin.address;
      const data = abi.simpleEncode(
        'inject(address[],uint256[])',
        token,
        value
      );
      await this.token0.transfer(user, value[0], {
        from: providerAddresses[0],
      });
      await this.token0.approve(this.proxy.address, value[0], {from: user});
      await this.token1.transfer(user, value[1], {
        from: providerAddresses[1],
      });
      await this.token1.approve(this.proxy.address, value[1], {from: user});

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
