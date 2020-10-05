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
const { ZERO_ADDRESS } = constants;
const abi = require('ethereumjs-abi');
const utils = web3.utils;

const { expect } = require('chai');

const { CETHER } = require('./utils/constants');
const { evmRevert, evmSnapshot, profileGas } = require('./utils/utils');

const StakingRewardsAdapterRegistry = artifacts.require(
  'StakingRewardsAdapterRegistry'
);

contract('StakingRewardsAdapterRegistry', function([
  _,
  handler1,
  handler2,
  someone,
]) {
  let id;

  beforeEach(async function() {
    this.registry = await StakingRewardsAdapterRegistry.new();
    id = await evmSnapshot();
  });

  afterEach(async function() {
    await evmRevert(id);
  });

  describe('register', function() {
    const info = utils.fromAscii('test');

    it('normal', async function() {
      await this.registry.register(handler1, info);
      expect(await this.registry.isValid.call(handler1)).to.be.true;
    });

    it('non owner', async function() {
      await expectRevert.unspecified(
        this.registry.register(handler1, info, { from: someone })
      );
    });

    it('zero address', async function() {
      await expectRevert.unspecified(
        this.registry.register(ZERO_ADDRESS, info)
      );
    });

    it('registered', async function() {
      await this.registry.register(handler1, info);
      await expectRevert(this.registry.register(handler1, info), 'registered');
    });

    it('unregistered', async function() {
      await this.registry.register(handler1, info);
      await this.registry.unregister(handler1);
      await expectRevert(this.registry.register(handler1, info), 'registered');
    });
  });

  describe('unregister', function() {
    beforeEach(async function() {
      const info = utils.fromAscii('test');
      await this.registry.register(handler1, info);
    });

    it('normal', async function() {
      await this.registry.unregister(handler1);
      expect(await this.registry.isValid.call(handler1)).to.be.false;
    });

    it('non owner', async function() {
      await expectRevert.unspecified(
        this.registry.unregister(handler1, { from: someone })
      );
    });

    it('no registration', async function() {
      await expectRevert(this.registry.unregister(handler2), 'no registration');
    });

    it('unregistered', async function() {
      await this.registry.unregister(handler1);
      await expectRevert(this.registry.unregister(handler1), 'unregistered');
    });
  });

  describe('update info', function() {
    beforeEach(async function() {
      const info = utils.fromAscii('test');
      await this.registry.register(handler1, info);
    });

    const newInfo = utils.fromAscii('updated');

    it('normal', async function() {
      await this.registry.updateInfo(handler1, newInfo);
      const result = await this.registry.getInfo.call(handler1);
      expect(result).eq(utils.padRight(utils.asciiToHex('updated'), 64));
    });

    it('non owner', async function() {
      await expectRevert.unspecified(
        this.registry.updateInfo(handler1, newInfo, { from: someone })
      );
    });

    it('no registration', async function() {
      await expectRevert(
        this.registry.updateInfo(handler2, newInfo),
        'no registration'
      );
    });

    it('unregistered', async function() {
      await this.registry.unregister(handler1);
      await expectRevert(
        this.registry.updateInfo(handler1, newInfo),
        'unregistered'
      );
    });
  });

  describe('get info', function() {
    beforeEach(async function() {
      const info = utils.fromAscii('test');
      await this.registry.register(handler1, info);
    });

    it('normal', async function() {
      const result = await this.registry.getInfo.call(handler1);
      expect(result).eq(utils.padRight(utils.asciiToHex('test'), 64));
    });

    it('unregistered', async function() {
      await this.registry.unregister(handler1);
      const result = await this.registry.getInfo.call(handler1);
      expect(result).eq(utils.padRight(utils.asciiToHex('deprecated'), 64));
    });
  });
});
