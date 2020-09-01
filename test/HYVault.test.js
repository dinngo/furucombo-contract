const { BN, ether } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');
const abi = require('ethereumjs-abi');
const utils = web3.utils;
const {
  CURVE_YCRV,
  CURVE_YCRV_PROVIDER,
  YEARN_YCRV_VAULT,
  ALINK,
  ALINK_PROVIDER,
  YEARN_ALINK_VAULT,
} = require('./utils/constants');
const {
  profileGas,
  evmSnapshot,
  evmRevertAndSnapshot,
} = require('./utils/utils');

const Registry = artifacts.require('Registry');
const Proxy = artifacts.require('ProxyMock');
const HYVault = artifacts.require('HYVault');
const IYVault = artifacts.require('IYVault');
const IToken = artifacts.require('IERC20');

contract('YVault', function([user]) {
  before(async function() {
    this.registry = await Registry.new();
    this.proxy = await Proxy.new(this.registry.address);
    this.hYVault = await HYVault.new();
    await this.registry.register(
      this.hYVault.address,
      utils.asciiToHex('HYVault')
    );
    this.id = await evmSnapshot();
  });

  beforeEach(async function() {
    this.id = await evmRevertAndSnapshot(this.id);
  });

  describe('Deposit', function() {
    it('yCRV vault', async function() {
      const vault = await IYVault.at(YEARN_YCRV_VAULT);
      const token = await IToken.at(CURVE_YCRV);
      const amount = ether('1');
      const data = abi.simpleEncode(
        'deposit(address,uint256)',
        vault.address,
        amount
      );
      await token.transfer(this.proxy.address, amount, {
        from: CURVE_YCRV_PROVIDER,
      });
      await this.proxy.updateTokenMock(token.address);
      const ratio = await vault.getPricePerFullShare.call();
      const receipt = await this.proxy.execMock(this.hYVault.address, data, {
        from: user,
        value: ether('0.1'),
      });

      // Check proxy balance
      expect(await vault.balanceOf.call(this.proxy.address)).to.be.zero;
      expect(await token.balanceOf.call(this.proxy.address)).to.be.zero;

      // Check user vault balance >= 99.9% expected result
      expect(await vault.balanceOf.call(user)).to.be.bignumber.lte(
        amount.mul(ether('1')).div(ratio)
      );
      expect(await vault.balanceOf.call(user)).to.be.bignumber.gte(
        amount
          .mul(ether('1'))
          .div(ratio)
          .mul(new BN('999'))
          .div(new BN('1000'))
      );

      profileGas(receipt);
    });
  });

  describe('Withdraw', function() {
    it('aLINK delegated vault', async function() {
      const vault = await IYVault.at(YEARN_ALINK_VAULT);
      const token = await IToken.at(ALINK);

      // User deposits aLINK to get yaLINK
      const amountDeposit = ether('1');
      const dataDeposit = abi.simpleEncode(
        'deposit(address,uint256)',
        vault.address,
        amountDeposit
      );
      await token.transfer(this.proxy.address, amountDeposit, {
        from: ALINK_PROVIDER,
      });
      await this.proxy.updateTokenMock(token.address);
      await this.proxy.execMock(this.hYVault.address, dataDeposit, {
        from: user,
        value: ether('0.1'),
      });

      // User withdraws aLINK by yaLINK
      const amount = await vault.balanceOf.call(user);
      const data = abi.simpleEncode(
        'withdraw(address,uint256)',
        vault.address,
        amount
      );
      await vault.transfer(this.proxy.address, amount, {
        from: user,
      });
      await this.proxy.updateTokenMock(vault.address);
      const ratio = await vault.getPricePerFullShare.call();
      const receipt = await this.proxy.execMock(this.hYVault.address, data, {
        from: user,
        value: ether('0.1'),
      });

      // Check proxy balance
      expect(await vault.balanceOf.call(this.proxy.address)).to.be.zero;
      expect(await token.balanceOf.call(this.proxy.address)).to.be.zero;

      // Check user vault balance
      expect(await vault.balanceOf.call(user)).to.be.zero;

      // Check user token balance <= 100.1% expected result
      expect(await token.balanceOf.call(user)).to.be.bignumber.gte(
        amount.mul(ratio).div(ether('1'))
      );
      expect(await token.balanceOf.call(user)).to.be.bignumber.lte(
        amount
          .mul(ratio)
          .div(ether('1'))
          .mul(new BN('1001'))
          .div(new BN('1000'))
      );

      profileGas(receipt);
    });
  });
});
