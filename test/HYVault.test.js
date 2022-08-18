const { balance, BN, ether, constants } = require('@openzeppelin/test-helpers');
const { MAX_UINT256 } = constants;
const { tracker } = balance;
const { expect } = require('chai');
const abi = require('ethereumjs-abi');
const utils = web3.utils;
const {
  CURVE_YCRV,
  YEARN_YCRV_VAULT,
  YEARN_YWETH_VAULT,
} = require('./utils/constants');
const {
  evmRevert,
  evmSnapshot,
  profileGas,
  getHandlerReturn,
  tokenProviderCurveGauge,
} = require('./utils/utils');

const Registry = artifacts.require('Registry');
const Proxy = artifacts.require('ProxyMock');
const HYVault = artifacts.require('HYVault');
const IYVault = artifacts.require('IYVault');
const IToken = artifacts.require('IERC20');

contract('YVault', function([_, user]) {
  let id;
  let yCrvProviderAddress;

  before(async function() {
    yCrvProviderAddress = await tokenProviderCurveGauge(CURVE_YCRV);

    this.registry = await Registry.new();
    this.proxy = await Proxy.new(this.registry.address);
    this.hYVault = await HYVault.new();
    await this.registry.register(
      this.hYVault.address,
      utils.asciiToHex('HYVault')
    );
  });

  beforeEach(async function() {
    id = await evmSnapshot();
  });

  afterEach(async function() {
    await evmRevert(id);
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
        from: yCrvProviderAddress,
      });
      await this.proxy.updateTokenMock(token.address);
      const ratio = await vault.getPricePerFullShare.call();
      const receipt = await this.proxy.execMock(this.hYVault.address, data, {
        from: user,
        value: ether('0.1'),
      });

      // Get handler return result
      const handlerReturn = utils.toBN(
        getHandlerReturn(receipt, ['uint256'])[0]
      );
      expect(handlerReturn).to.be.bignumber.eq(
        await vault.balanceOf.call(user)
      );

      // Check proxy balance
      expect(
        await vault.balanceOf.call(this.proxy.address)
      ).to.be.bignumber.zero;
      expect(
        await token.balanceOf.call(this.proxy.address)
      ).to.be.bignumber.zero;

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

    it('yCRV vault with max amount', async function() {
      const vault = await IYVault.at(YEARN_YCRV_VAULT);
      const token = await IToken.at(CURVE_YCRV);
      const amount = ether('1');
      const data = abi.simpleEncode(
        'deposit(address,uint256)',
        vault.address,
        MAX_UINT256
      );
      await token.transfer(this.proxy.address, amount, {
        from: yCrvProviderAddress,
      });
      await this.proxy.updateTokenMock(token.address);
      const ratio = await vault.getPricePerFullShare.call();
      const receipt = await this.proxy.execMock(this.hYVault.address, data, {
        from: user,
        value: ether('0.1'),
      });

      // Get handler return result
      const handlerReturn = utils.toBN(
        getHandlerReturn(receipt, ['uint256'])[0]
      );
      expect(handlerReturn).to.be.bignumber.eq(
        await vault.balanceOf.call(user)
      );

      // Check proxy balance
      expect(
        await vault.balanceOf.call(this.proxy.address)
      ).to.be.bignumber.zero;
      expect(
        await token.balanceOf.call(this.proxy.address)
      ).to.be.bignumber.zero;

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

    it('yWETH vault', async function() {
      let balanceUser = await tracker(user);
      const vault = await IYVault.at(YEARN_YWETH_VAULT);
      const value = ether('1');
      const data = abi.simpleEncode(
        'depositETH(uint256,address)',
        value,
        vault.address
      );
      const ratio = await vault.getPricePerFullShare.call();
      const receipt = await this.proxy.execMock(this.hYVault.address, data, {
        from: user,
        value: value,
      });

      // Get handler return result
      const handlerReturn = utils.toBN(
        getHandlerReturn(receipt, ['uint256'])[0]
      );
      expect(handlerReturn).to.be.bignumber.eq(
        await vault.balanceOf.call(user)
      );

      // Check proxy balance
      expect(
        await vault.balanceOf.call(this.proxy.address)
      ).to.be.bignumber.zero;
      expect(await balance.current(this.proxy.address)).to.be.bignumber.zero;

      // Check user vault balance >= 99.9% expected result
      expect(await vault.balanceOf.call(user)).to.be.bignumber.lte(
        value.mul(ether('1')).div(ratio)
      );
      expect(await vault.balanceOf.call(user)).to.be.bignumber.gte(
        value
          .mul(ether('1'))
          .div(ratio)
          .mul(new BN('999'))
          .div(new BN('1000'))
      );
      // Check user eth balance
      expect(await balanceUser.delta()).to.be.bignumber.eq(
        ether('0').sub(value)
      );
      profileGas(receipt);
    });

    it('yWETH vault with max amount', async function() {
      let balanceUser = await tracker(user);
      const vault = await IYVault.at(YEARN_YWETH_VAULT);
      const value = ether('1');
      const data = abi.simpleEncode(
        'depositETH(uint256,address)',
        MAX_UINT256,
        vault.address
      );
      const ratio = await vault.getPricePerFullShare.call();
      const receipt = await this.proxy.execMock(this.hYVault.address, data, {
        from: user,
        value: value,
      });

      // Get handler return result
      const handlerReturn = utils.toBN(
        getHandlerReturn(receipt, ['uint256'])[0]
      );
      expect(handlerReturn).to.be.bignumber.eq(
        await vault.balanceOf.call(user)
      );

      // Check proxy balance
      expect(
        await vault.balanceOf.call(this.proxy.address)
      ).to.be.bignumber.zero;
      expect(await balance.current(this.proxy.address)).to.be.bignumber.zero;

      // Check user vault balance >= 99.9% expected result
      expect(await vault.balanceOf.call(user)).to.be.bignumber.lte(
        value.mul(ether('1')).div(ratio)
      );
      expect(await vault.balanceOf.call(user)).to.be.bignumber.gte(
        value
          .mul(ether('1'))
          .div(ratio)
          .mul(new BN('999'))
          .div(new BN('1000'))
      );
      // Check user eth balance
      expect(await balanceUser.delta()).to.be.bignumber.eq(
        ether('0').sub(value)
      );
      profileGas(receipt);
    });
  });

  describe('Withdraw', function() {
    it('yWETH vault', async function() {
      const vault = await IYVault.at(YEARN_YWETH_VAULT);

      // User deposits ETH to get yWETH
      const amountDeposit = ether('1');
      await vault.depositETH({
        from: user,
        value: amountDeposit,
      });

      // User withdraws ETH by yWETH
      const amount = await vault.balanceOf.call(user);
      const data = abi.simpleEncode(
        'withdrawETH(address,uint256)',
        vault.address,
        amount
      );
      await vault.transfer(this.proxy.address, amount, {
        from: user,
      });
      await this.proxy.updateTokenMock(vault.address);
      const ratio = await vault.getPricePerFullShare.call();
      const balanceUser = await tracker(user);
      const receipt = await this.proxy.execMock(this.hYVault.address, data, {
        from: user,
        value: ether('0.1'),
      });

      // Get handler return result
      const handlerReturn = utils.toBN(
        getHandlerReturn(receipt, ['uint256'])[0]
      );
      const delta = await balanceUser.delta();
      expect(delta).to.be.bignumber.eq(handlerReturn);

      // Check proxy balance
      expect(
        await vault.balanceOf.call(this.proxy.address)
      ).to.be.bignumber.zero;
      expect(await balance.current(this.proxy.address)).to.be.bignumber.zero;

      // Check user vault balance
      expect(await vault.balanceOf.call(user)).to.be.bignumber.zero;

      // Check user eth balance <= 100.1% expected result
      expect(delta).to.be.bignumber.gte(amount.mul(ratio).div(ether('1')));
      expect(delta).to.be.bignumber.lte(
        amount
          .mul(ratio)
          .div(ether('1'))
          .mul(new BN('1001'))
          .div(new BN('1000'))
      );

      profileGas(receipt);
    });

    it('yWETH vault with max amount', async function() {
      const vault = await IYVault.at(YEARN_YWETH_VAULT);

      // User deposits ETH to get yWETH
      const amountDeposit = ether('1');
      await vault.depositETH({
        from: user,
        value: amountDeposit,
      });

      // User withdraws ETH by yWETH
      const amount = await vault.balanceOf.call(user);
      const data = abi.simpleEncode(
        'withdrawETH(address,uint256)',
        vault.address,
        MAX_UINT256
      );
      await vault.transfer(this.proxy.address, amount, {
        from: user,
      });
      await this.proxy.updateTokenMock(vault.address);
      const ratio = await vault.getPricePerFullShare.call();
      const balanceUser = await tracker(user);
      const receipt = await this.proxy.execMock(this.hYVault.address, data, {
        from: user,
        value: ether('0.1'),
      });

      // Get handler return result
      const handlerReturn = utils.toBN(
        getHandlerReturn(receipt, ['uint256'])[0]
      );
      const delta = await balanceUser.delta();
      expect(delta).to.be.bignumber.eq(handlerReturn);

      // Check proxy balance
      expect(
        await vault.balanceOf.call(this.proxy.address)
      ).to.be.bignumber.zero;
      expect(await balance.current(this.proxy.address)).to.be.bignumber.zero;

      // Check user vault balance
      expect(await vault.balanceOf.call(user)).to.be.bignumber.zero;

      // Check user eth balance <= 100.1% expected result
      expect(delta).to.be.bignumber.gte(amount.mul(ratio).div(ether('1')));
      expect(delta).to.be.bignumber.lte(
        amount
          .mul(ratio)
          .div(ether('1'))
          .mul(new BN('1001'))
          .div(new BN('1000'))
      );

      profileGas(receipt);
    });

    it('yCRV vault', async function() {
      const vault = await IYVault.at(YEARN_YCRV_VAULT);
      const token = await IToken.at(CURVE_YCRV);

      // User deposits CRV to get yCRV
      const amountDeposit = ether('1');
      await token.transfer(user, amountDeposit, {
        from: yCrvProviderAddress,
      });
      await token.approve(vault.address, amountDeposit, {
        from: user,
      });
      await vault.deposit(amountDeposit, {
        from: user,
      });

      // User withdraws token by yToken
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
      const tokenBalanceUser = await token.balanceOf.call(user);
      const receipt = await this.proxy.execMock(this.hYVault.address, data, {
        from: user,
        value: ether('0.1'),
      });

      // Get handler return result
      const handlerReturn = utils.toBN(
        getHandlerReturn(receipt, ['uint256'])[0]
      );
      const delta = (await token.balanceOf.call(user)).sub(tokenBalanceUser);
      expect(delta).to.be.bignumber.eq(handlerReturn);

      // Check proxy balance
      expect(await balance.current(this.proxy.address)).to.be.bignumber.zero;
      expect(
        await vault.balanceOf.call(this.proxy.address)
      ).to.be.bignumber.zero;
      expect(
        await token.balanceOf.call(this.proxy.address)
      ).to.be.bignumber.zero;

      // Check user vault balance
      expect(await vault.balanceOf.call(user)).to.be.bignumber.zero;

      // Check user token balance <= 100.1% expected result
      expect(delta).to.be.bignumber.gte(amount.mul(ratio).div(ether('1')));
      expect(delta).to.be.bignumber.lte(
        amount
          .mul(ratio)
          .div(ether('1'))
          .mul(new BN('1001'))
          .div(new BN('1000'))
      );

      profileGas(receipt);
    });
    it('yCRV vault with max amount', async function() {
      const vault = await IYVault.at(YEARN_YCRV_VAULT);
      const token = await IToken.at(CURVE_YCRV);

      // User deposits CRV to get yCRV
      const amountDeposit = ether('1');
      await token.transfer(user, amountDeposit, {
        from: yCrvProviderAddress,
      });
      await token.approve(vault.address, amountDeposit, {
        from: user,
      });
      await vault.deposit(amountDeposit, {
        from: user,
      });

      // User withdraws token by yToken
      const amount = await vault.balanceOf.call(user);
      const data = abi.simpleEncode(
        'withdraw(address,uint256)',
        vault.address,
        MAX_UINT256
      );
      await vault.transfer(this.proxy.address, amount, {
        from: user,
      });
      await this.proxy.updateTokenMock(vault.address);
      const ratio = await vault.getPricePerFullShare.call();

      const tokenBalanceUser = await token.balanceOf.call(user);
      const receipt = await this.proxy.execMock(this.hYVault.address, data, {
        from: user,
        value: ether('0.1'),
      });

      // Get handler return result
      const handlerReturn = utils.toBN(
        getHandlerReturn(receipt, ['uint256'])[0]
      );
      const delta = (await token.balanceOf.call(user)).sub(tokenBalanceUser);
      expect(delta).to.be.bignumber.eq(handlerReturn);

      // Check proxy balance
      expect(await balance.current(this.proxy.address)).to.be.bignumber.zero;
      expect(
        await vault.balanceOf.call(this.proxy.address)
      ).to.be.bignumber.zero;
      expect(
        await token.balanceOf.call(this.proxy.address)
      ).to.be.bignumber.zero;

      // Check user vault balance
      expect(await vault.balanceOf.call(user)).to.be.bignumber.zero;

      // Check user token balance <= 100.1% expected result
      expect(delta).to.be.bignumber.gte(amount.mul(ratio).div(ether('1')));
      expect(delta).to.be.bignumber.lte(
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
