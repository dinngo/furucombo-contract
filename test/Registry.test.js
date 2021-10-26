const {
  constants,
  expectEvent,
  expectRevert,
} = require('@openzeppelin/test-helpers');
const { ZERO_ADDRESS } = constants;
const abi = require('ethereumjs-abi');
const utils = web3.utils;

const { expect } = require('chai');

const { CETHER } = require('./utils/constants');
const { evmRevert, evmSnapshot, profileGas } = require('./utils/utils');

const Registry = artifacts.require('Registry');

contract('Registry', function([_, contract1, contract2, someone]) {
  let id;
  const info = utils.fromAscii('test');
  const info2 = utils.fromAscii('test2');
  const infoPaddedHex = utils.padRight(utils.asciiToHex('test'), 64);
  const deprecatedPaddedHex = utils.padRight(
    utils.asciiToHex('deprecated'),
    64
  );

  before(async function() {
    this.registry = await Registry.new();
  });

  beforeEach(async function() {
    id = await evmSnapshot();
  });

  afterEach(async function() {
    await evmRevert(id);
  });

  describe('register', function() {
    it('normal', async function() {
      const receipt = await this.registry.register(contract1, info);
      expect(await this.registry.isValidHandler.call(contract1)).to.be.true;
      expectEvent(receipt, 'Registered', {
        registration: contract1,
        info: infoPaddedHex,
      });
    });

    it('non owner', async function() {
      await expectRevert.unspecified(
        this.registry.register(contract1, info, { from: someone })
      );
    });

    it('zero address', async function() {
      await expectRevert.unspecified(
        this.registry.register(ZERO_ADDRESS, info)
      );
    });

    it('set info', async function() {
      await this.registry.register(contract1, info);
      await this.registry.register(contract1, info2);
      expect(await this.registry.isValidHandler.call(contract1)).to.be.true;
    });

    it('unregistered', async function() {
      await this.registry.register(contract1, info);
      await this.registry.unregister(contract1);
      await expectRevert(
        this.registry.register(contract1, info),
        'unregistered'
      );
    });
  });

  describe('unregister', function() {
    beforeEach(async function() {
      await this.registry.register(contract1, info);
    });

    it('normal', async function() {
      const receipt = await this.registry.unregister(contract1);
      expect(await this.registry.isValidHandler.call(contract1)).to.be.false;
      expectEvent(receipt, 'Unregistered', { registration: contract1 });
    });

    it('non owner', async function() {
      await expectRevert.unspecified(
        this.registry.unregister(contract1, { from: someone })
      );
    });

    it('no registration', async function() {
      await expectRevert(
        this.registry.unregister(contract2),
        'no registration'
      );
    });

    it('unregistered', async function() {
      await this.registry.unregister(contract1);
      await expectRevert(this.registry.unregister(contract1), 'unregistered');
    });
  });

  describe('register caller', function() {
    it('normal', async function() {
      const receipt = await this.registry.registerCaller(contract1, info);
      expect(await this.registry.isValidCaller.call(contract1)).to.be.true;
      expectEvent(receipt, 'CallerRegistered', {
        registration: contract1,
        info: infoPaddedHex,
      });
    });

    it('non owner', async function() {
      await expectRevert.unspecified(
        this.registry.registerCaller(contract1, info, { from: someone })
      );
    });

    it('zero address', async function() {
      await expectRevert.unspecified(
        this.registry.registerCaller(ZERO_ADDRESS, info)
      );
    });

    it('set info', async function() {
      await this.registry.registerCaller(contract1, info);
      await this.registry.registerCaller(contract1, info2);
      expect(await this.registry.isValidCaller.call(contract1)).to.be.true;
    });

    it('unregistered', async function() {
      await this.registry.registerCaller(contract1, info);
      await this.registry.unregisterCaller(contract1);
      await expectRevert(
        this.registry.registerCaller(contract1, info),
        'unregistered'
      );
    });
  });

  describe('unregister caller', function() {
    beforeEach(async function() {
      await this.registry.registerCaller(contract1, info);
    });

    it('normal', async function() {
      const receipt = await this.registry.unregisterCaller(contract1);
      expect(await this.registry.isValidCaller.call(contract1)).to.be.false;
      expectEvent(receipt, 'CallerUnregistered', { registration: contract1 });
    });

    it('non owner', async function() {
      await expectRevert.unspecified(
        this.registry.unregisterCaller(contract1, { from: someone })
      );
    });

    it('no registration', async function() {
      await expectRevert(
        this.registry.unregisterCaller(contract2),
        'no registration'
      );
    });

    it('unregistered', async function() {
      await this.registry.unregisterCaller(contract1);
      await expectRevert(
        this.registry.unregisterCaller(contract1),
        'unregistered'
      );
    });
  });

  describe('get info', function() {
    describe('handler', function() {
      beforeEach(async function() {
        await this.registry.register(contract1, info);
      });

      it('normal', async function() {
        const result = await this.registry.handlers.call(contract1);
        expect(result).eq(infoPaddedHex);
      });

      it('unregistered', async function() {
        await this.registry.unregister(contract1);
        const result = await this.registry.handlers.call(contract1);
        expect(result).eq(deprecatedPaddedHex);
      });
    });

    describe('caller', function() {
      beforeEach(async function() {
        await this.registry.registerCaller(contract1, info);
      });

      it('normal', async function() {
        const result = await this.registry.callers.call(contract1);
        expect(result).eq(infoPaddedHex);
      });

      it('unregistered', async function() {
        await this.registry.unregisterCaller(contract1);
        const result = await this.registry.callers.call(contract1);
        expect(result).eq(deprecatedPaddedHex);
      });
    });
  });

  describe('is valid', function() {
    beforeEach(async function() {
      await this.registry.register(contract1, info);
      await this.registry.registerCaller(contract2, info);
    });

    describe('handler', function() {
      it('normal', async function() {
        expect(await this.registry.isValidHandler.call(contract1)).to.be.true;
      });

      it('wrong type', async function() {
        expect(await this.registry.isValidCaller.call(contract1)).to.be.false;
      });

      it('removed', async function() {
        await this.registry.unregister(contract1);
        expect(await this.registry.isValidHandler.call(contract1)).to.be.false;
      });
    });

    describe('caller', function() {
      it('normal', async function() {
        expect(await this.registry.isValidCaller.call(contract2)).to.be.true;
      });

      it('wrong type', async function() {
        expect(await this.registry.isValidHandler.call(contract2)).to.be.false;
      });

      it('removed', async function() {
        await this.registry.unregisterCaller(contract2);
        expect(await this.registry.isValidCaller.call(contract2)).to.false;
      });
    });
  });

  describe('halt', function() {
    beforeEach(async function() {
      await this.registry.register(contract1, info);
      await this.registry.registerCaller(contract2, info);
    });

    it('normal', async function() {
      expect(await this.registry.fHalt.call()).to.be.false;
      const receipt = await this.registry.halt();
      expectEvent(receipt, 'Halted');
      expect(await this.registry.fHalt.call()).to.be.true;
    });

    it('non owner', async function() {
      await expectRevert(
        this.registry.halt({ from: someone }),
        'Ownable: caller is not the owner'
      );
    });

    it('halted', async function() {
      await this.registry.halt();
      await expectRevert(this.registry.halt(), 'Halted');
    });
  });

  describe('unhalt', function() {
    beforeEach(async function() {
      await this.registry.register(contract1, info);
      await this.registry.registerCaller(contract2, info);
      await this.registry.halt();
    });

    it('normal', async function() {
      expect(await this.registry.fHalt.call()).to.be.true;
      const receipt = await this.registry.unhalt();
      expectEvent(receipt, 'Unhalted');
      expect(await this.registry.fHalt.call()).to.be.false;
    });

    it('non owner', async function() {
      await expectRevert(
        this.registry.unhalt({ from: someone }),
        'Ownable: caller is not the owner'
      );
    });

    it('not halted', async function() {
      await this.registry.unhalt();
      await expectRevert(this.registry.unhalt(), 'Not halted');
    });
  });

  describe('ban', function() {
    beforeEach(async function() {
      await this.registry.register(contract1, info);
      await this.registry.registerCaller(contract2, info);
    });

    it('normal', async function() {
      expect(await this.registry.bannedAgents.call(someone)).to.be.zero;
      const receipt = await this.registry.ban(someone);
      expectEvent(receipt, 'Banned', { agent: someone });
      expect(await this.registry.bannedAgents.call(someone)).to.be.not.zero;
    });

    it('non owner', async function() {
      await expectRevert(
        this.registry.ban(_, { from: someone }),
        'Ownable: caller is not the owner'
      );
    });

    it('banned', async function() {
      await this.registry.ban(someone);
      await expectRevert(this.registry.ban(someone), 'Banned');
    });
  });

  describe('unban', function() {
    beforeEach(async function() {
      await this.registry.register(contract1, info);
      await this.registry.registerCaller(contract2, info);
      await this.registry.ban(someone);
    });

    it('normal', async function() {
      expect(await this.registry.bannedAgents.call(someone)).to.be.not.zero;
      const receipt = await this.registry.unban(someone);
      expectEvent(receipt, 'Unbanned', { agent: someone });
      expect(await this.registry.bannedAgents.call(someone)).to.be.zero;
    });

    it('non owner', async function() {
      await expectRevert(
        this.registry.unban(someone, { from: someone }),
        'Ownable: caller is not the owner'
      );
    });

    it('not banned', async function() {
      await this.registry.unban(someone);
      await expectRevert(this.registry.unban(someone), 'Not banned');
    });
  });
});
