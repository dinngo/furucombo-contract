if (network.config.chainId == 1) {
  // This test supports to run on these chains.
} else {
  return;
}

const { constants } = require('@openzeppelin/test-helpers');
const abi = require('ethereumjs-abi');

const { expect } = require('chai');

const { MAKER_PROXY_REGISTRY } = require('./utils/constants');
const { evmRevert, evmSnapshot } = require('./utils/utils');

const DSGuardFactory = artifacts.require('DSGuardFactory');
const DSGuard = artifacts.require('DSGuard');
const IDSProxy = artifacts.require('IDSProxy');
const IDSProxyRegistry = artifacts.require('IDSProxyRegistry');

contract('DSGuardFactory', function ([_, furucombo, user, someone]) {
  let id;
  const sig =
    '0x' + abi.methodID('execute', ['address', 'bytes']).toString('hex');
  const sigNotPermit =
    '0x' + abi.methodID('execute', ['bytes', 'bytes']).toString('hex');

  before(async function () {
    this.factory = await DSGuardFactory.new();
    this.dsRegistry = await IDSProxyRegistry.at(MAKER_PROXY_REGISTRY);
    // User build DSProxy
    const dsProxyAddr = await this.dsRegistry.proxies.call(user);
    if (dsProxyAddr == constants.ZERO_ADDRESS)
      await this.dsRegistry.build(user);

    this.userProxy = await IDSProxy.at(
      await this.dsRegistry.proxies.call(user)
    );
  });

  beforeEach(async function () {
    id = await evmSnapshot();
  });

  afterEach(async function () {
    await evmRevert(id);
  });

  describe('New Guard', function () {
    it('with permission', async function () {
      await this.factory.newGuard(true, furucombo, this.userProxy.address, {
        from: user,
      });
      const guardAddr = await this.factory.guards.call(user);
      this.guard = await DSGuard.at(guardAddr);
      expect(await this.factory.isGuard.call(guardAddr)).to.be.true;
      expect(await this.guard.owner.call()).to.be.eq(user);
      // Verify furucombo do have permission to call the permitted function
      expect(
        await this.guard.canCall.call(furucombo, this.userProxy.address, sig)
      ).to.be.true;
      // Verify furucombo do not have permission to call unpermitted function
      expect(
        await this.guard.canCall.call(
          furucombo,
          this.userProxy.address,
          sigNotPermit
        )
      ).to.be.false;
      // Verify others do not have permission to call the function
      expect(
        await this.guard.canCall.call(someone, this.userProxy.address, sig)
      ).to.be.false;
    });

    it('without permission', async function () {
      await this.factory.newGuard(false, furucombo, this.userProxy.address, {
        from: user,
      });
      const guardAddr = await this.factory.guards.call(user);
      this.guard = await DSGuard.at(guardAddr);
      expect(await this.factory.isGuard.call(guardAddr)).to.be.true;
      expect(await this.guard.owner.call()).to.be.eq(user);
      // Verify furucombo do not have permission to call the function
      expect(
        await this.guard.canCall.call(furucombo, this.userProxy.address, sig)
      ).to.be.false;
    });
  });
});
