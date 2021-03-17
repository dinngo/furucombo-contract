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

const { COMBO_TOKEN, COMBO_PROVIDER } = require('./utils/constants');
const { evmRevert, evmSnapshot, profileGas } = require('./utils/utils');

const HFurucomboRCOMBO = artifacts.require('HFurucomboRCOMBO');
const Registry = artifacts.require('Registry');
const Proxy = artifacts.require('ProxyMock');
const IToken = artifacts.require('IERC20');
const RCOMBO = artifacts.require('RCOMBO');

contract('Furucombo rCOMBO', function([_, deployer, user]) {
  before(async function() {
    this.registry = await Registry.new();
    this.proxy = await Proxy.new(this.registry.address);
    this.hFurucomboRCOMBO = await HFurucomboRCOMBO.new();
    await this.registry.register(
      this.hFurucomboRCOMBO.address,
      utils.asciiToHex('HFurucomboRCOMBO')
    );

    const supply = ether('100');
    this.rCOMBO = await RCOMBO.new(supply, 1614556800, {
      from: deployer,
    }); // Mar 01 2021 00:00:00 UTC
    this.combo = await IToken.at(COMBO_TOKEN);
    await this.combo.transfer(this.rCOMBO.address, supply, {
      from: COMBO_PROVIDER,
    });
  });

  beforeEach(async function() {
    id = await evmSnapshot();
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
      const data = abi.simpleEncode(
        'provideFor(address,uint256)',
        this.rCOMBO.address,
        amount
      );

      // Send rCOMBO to proxy
      await this.rCOMBO.transfer(this.proxy.address, amount, {
        from: deployer,
      });
      await this.proxy.updateTokenMock(this.rCOMBO.address);

      // Execute proxy
      const receipt = await this.proxy.execMock(to, data, {
        from: user,
        value: ether('0.1'),
      });

      // Verify
      expect(await balanceProxy.get()).to.be.zero;
      expect(await balanceUser.delta()).to.be.bignumber.eq(
        ether('0').sub(new BN(receipt.receipt.gasUsed))
      );
      expect(await this.rCOMBO.balanceOf.call(this.proxy.address)).to.be.zero;
      expect(await this.rCOMBO.balanceOf.call(user)).to.be.zero;
      expect(await this.rCOMBO.provided(user)).to.be.bignumber.eq(amount);

      profileGas(receipt);
    });

    it('max amount', async function() {
      const amount = ether('10');
      const to = this.hFurucomboRCOMBO.address;
      const data = abi.simpleEncode(
        'provideFor(address,uint256)',
        this.rCOMBO.address,
        MAX_UINT256
      );

      // Send rCOMBO to proxy
      await this.rCOMBO.transfer(this.proxy.address, amount, {
        from: deployer,
      });
      await this.proxy.updateTokenMock(this.rCOMBO.address);

      // Execute proxy
      const receipt = await this.proxy.execMock(to, data, {
        from: user,
        value: ether('0.1'),
      });

      // Verify
      expect(await balanceProxy.get()).to.be.zero;
      expect(await balanceUser.delta()).to.be.bignumber.eq(
        ether('0').sub(new BN(receipt.receipt.gasUsed))
      );
      expect(await this.rCOMBO.balanceOf.call(this.proxy.address)).to.be.zero;
      expect(await this.rCOMBO.balanceOf.call(user)).to.be.zero;
      expect(await this.rCOMBO.provided(user)).to.be.bignumber.eq(amount);

      profileGas(receipt);
    });

    it('should revert: provide 0 amount', async function() {
      const amount = ether('0');
      const to = this.hFurucomboRCOMBO.address;
      const data = abi.simpleEncode(
        'provideFor(address,uint256)',
        this.rCOMBO.address,
        amount
      );

      // Send rCOMBO to proxy
      await this.rCOMBO.transfer(this.proxy.address, amount, {
        from: deployer,
      });
      await this.proxy.updateTokenMock(this.rCOMBO.address);

      await expectRevert(
        this.proxy.execMock(to, data, {
          from: user,
          value: ether('0.1'),
        }),
        'provideFor: provide 0 amount'
      );
    });
  });

  describe('withdrawFor', function() {
    beforeEach(async function() {
      // User provides rCOMBO
      var amount = ether('10');
      await this.rCOMBO.transfer(user, amount, {
        from: deployer,
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
      const data = abi.simpleEncode(
        'withdrawFor(address)',
        this.rCOMBO.address
      );

      // Execute proxy
      const receipt = await this.proxy.execMock(to, data, {
        from: user,
        value: ether('0.1'),
      });

      // Verify
      expect(await balanceProxy.get()).to.be.zero;
      expect(await balanceUser.delta()).to.be.bignumber.eq(
        ether('0').sub(new BN(receipt.receipt.gasUsed))
      );
      expect(await this.combo.balanceOf.call(this.proxy.address)).to.be.zero;
      expect(await this.combo.balanceOf(user)).to.be.bignumber.eq(
        await this.rCOMBO.released(user)
      );

      profileGas(receipt);
    });
  });
});
