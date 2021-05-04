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

const { COMBO_TOKEN, RCOMBO_TOKEN } = require('./utils/constants');
const {
  evmRevert,
  evmSnapshot,
  profileGas,
  tokenProviderUniV2,
} = require('./utils/utils');

const HFurucomboRCOMBO = artifacts.require('HFurucomboRCOMBO');
const FeeRuleRegistry = artifacts.require('FeeRuleRegistry');
const Registry = artifacts.require('Registry');
const Proxy = artifacts.require('ProxyMock');
const IToken = artifacts.require('IERC20');
const IRCOMBO = artifacts.require('IRCOMBO');

contract('Furucombo rCOMBO', function([_, user]) {
  let comboProviderAddress;
  let rCOMBOProviderAddress;

  before(async function() {
    this.registry = await Registry.new();
    this.feeRuleRegistry = await FeeRuleRegistry.new('0', _);
    this.proxy = await Proxy.new(this.registry.address, this.feeRuleRegistry.address);
    this.hFurucomboRCOMBO = await HFurucomboRCOMBO.new();
    await this.registry.register(
      this.hFurucomboRCOMBO.address,
      utils.asciiToHex('HFurucomboRCOMBO')
    );
    this.rCOMBO = await IRCOMBO.at(RCOMBO_TOKEN);
    this.combo = await IToken.at(COMBO_TOKEN);

    comboProviderAddress = await tokenProviderUniV2(this.combo.address);
    rCOMBOProviderAddress = await tokenProviderUniV2(
      this.rCOMBO.address,
      this.combo.address
    );
  });

  beforeEach(async function() {
    id = await evmSnapshot();

    await this.combo.transfer(this.rCOMBO.address, ether('100'), {
      from: comboProviderAddress,
    });
  });

  afterEach(async function() {
    await evmRevert(id);
  });

  describe('provideFor', function() {
    beforeEach(async function() {
      balanceUser = await tracker(user);
      balanceProxy = await tracker(this.proxy.address);
    });

    it('normal', async function() {
      const amount = ether('10');
      const to = this.hFurucomboRCOMBO.address;
      const data = abi.simpleEncode('provideFor(uint256)', amount);

      // Send rCOMBO to proxy
      await this.rCOMBO.transfer(this.proxy.address, amount, {
        from: rCOMBOProviderAddress,
      });
      await this.proxy.updateTokenMock(this.rCOMBO.address);

      // Execute proxy
      const receipt = await this.proxy.execMock(to, data, {
        from: user,
        value: ether('0.1'),
      });

      // Verify
      expect(await balanceProxy.get()).to.be.bignumber.zero;
      expect(await balanceUser.delta()).to.be.bignumber.eq(ether('0'));
      expect(
        await this.rCOMBO.balanceOf.call(this.proxy.address)
      ).to.be.bignumber.zero;
      expect(await this.rCOMBO.balanceOf.call(user)).to.be.bignumber.zero;
      expect(await this.rCOMBO.provided(user)).to.be.bignumber.eq(amount);

      profileGas(receipt);
    });

    it('max amount', async function() {
      const amount = ether('10');
      const to = this.hFurucomboRCOMBO.address;
      const data = abi.simpleEncode('provideFor(uint256)', MAX_UINT256);

      // Send rCOMBO to proxy
      await this.rCOMBO.transfer(this.proxy.address, amount, {
        from: rCOMBOProviderAddress,
      });
      await this.proxy.updateTokenMock(this.rCOMBO.address);

      // Execute proxy
      const receipt = await this.proxy.execMock(to, data, {
        from: user,
        value: ether('0.1'),
      });

      // Verify
      expect(await balanceProxy.get()).to.be.bignumber.zero;
      expect(await balanceUser.delta()).to.be.bignumber.eq(ether('0'));
      expect(
        await this.rCOMBO.balanceOf.call(this.proxy.address)
      ).to.be.bignumber.zero;
      expect(await this.rCOMBO.balanceOf.call(user)).to.be.bignumber.zero;
      expect(await this.rCOMBO.provided(user)).to.be.bignumber.eq(amount);

      profileGas(receipt);
    });

    it('should revert: provide 0 amount', async function() {
      const amount = ether('0');
      const to = this.hFurucomboRCOMBO.address;
      const data = abi.simpleEncode('provideFor(uint256)', amount);

      await expectRevert(
        this.proxy.execMock(to, data, {
          from: user,
          value: ether('0.1'),
        }),
        'HFurucomboRCOMBO_provideFor: provide 0 amount'
      );
    });
  });

  describe('withdrawFor', function() {
    beforeEach(async function() {
      // User provides rCOMBO
      var amount = ether('10');
      await this.rCOMBO.transfer(user, amount, {
        from: rCOMBOProviderAddress,
      });
      await this.rCOMBO.approve(this.rCOMBO.address, amount, {
        from: user,
      });
      await this.rCOMBO.provide(amount, {
        from: user,
      });
      expect(await this.rCOMBO.provided(user)).to.be.bignumber.eq(amount);

      balanceUser = await tracker(user);
      balanceProxy = await tracker(this.proxy.address);
    });

    it('normal', async function() {
      const to = this.hFurucomboRCOMBO.address;
      const data = abi.simpleEncode('withdrawFor()');

      // Execute proxy
      const receipt = await this.proxy.execMock(to, data, {
        from: user,
        value: ether('0.1'),
      });

      // Verify
      expect(await balanceProxy.get()).to.be.bignumber.zero;
      expect(await balanceUser.delta()).to.be.bignumber.eq(ether('0'));
      expect(
        await this.combo.balanceOf.call(this.proxy.address)
      ).to.be.bignumber.zero;
      expect(await this.combo.balanceOf(user)).to.be.bignumber.eq(
        await this.rCOMBO.released(user)
      );
      expect(await this.rCOMBO.released(user)).to.be.not.zero;

      profileGas(receipt);
    });
  });
});
