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

const Registry = artifacts.require('Registry');

contract('Registry', function([_, contract1, contract2, someone]) {
  let id;
  const info = utils.fromAscii('test');
  const info2 = utils.fromAscii('test2');

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
      await this.registry.register(contract1, info);
      expect(await this.registry.isValidHandler.call(contract1)).to.be.true;
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
      await this.registry.unregister(contract1);
      expect(await this.registry.isValidHandler.call(contract1)).to.be.false;
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
      await this.registry.registerCaller(contract1, info);
      expect(await this.registry.isValidCaller.call(contract1)).to.be.true;
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
      await this.registry.unregisterCaller(contract1);
      expect(await this.registry.isValidCaller.call(contract1)).to.be.false;
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
        expect(result).eq(utils.padRight(utils.asciiToHex('test'), 64));
      });

      it('unregistered', async function() {
        await this.registry.unregister(contract1);
        const result = await this.registry.handlers.call(contract1);
        expect(result).eq(utils.padRight(utils.asciiToHex('deprecated'), 64));
      });
    });

    describe('caller', function() {
      beforeEach(async function() {
        await this.registry.registerCaller(contract1, info);
      });

      it('normal', async function() {
        const result = await this.registry.callers.call(contract1);
        expect(result).eq(utils.padRight(utils.asciiToHex('test'), 64));
      });

      it('unregistered', async function() {
        await this.registry.unregisterCaller(contract1);
        const result = await this.registry.callers.call(contract1);
        expect(result).eq(utils.padRight(utils.asciiToHex('deprecated'), 64));
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

      it('halted', async function() {
        await this.registry.halt();
        await expectRevert(
          this.registry.isValidHandler.call(contract1),
          'Halted'
        );
      });

      it('banned agent', async function() {
        expect(
          await this.registry.isValidHandler.call(contract1, { from: someone })
        ).to.be.true;
        await this.registry.ban(someone);
        await expectRevert(
          this.registry.isValidHandler.call(contract1, { from: someone }),
          'Banned'
        );
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

      it('halted', async function() {
        await this.registry.halt();
        await expectRevert(
          this.registry.isValidCaller.call(contract2),
          'Halted'
        );
      });

      it('banned agent', async function() {
        expect(
          await this.registry.isValidCaller.call(contract2, { from: someone })
        ).to.be.true;
        await this.registry.ban(someone);
        await expectRevert(
          this.registry.isValidCaller.call(contract2, { from: someone }),
          'Banned'
        );
      });
    });
  });
});
