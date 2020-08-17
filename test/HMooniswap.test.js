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
  ETH_TOKEN,
  DAI_TOKEN,
  DAI_PROVIDER,
  YFI_TOKEN,
  YFI_PROVIDER,
  MOONISWAP_ETH_DAI,
  MOONISWAP_YFI_DAI,
} = require('./utils/constants');
const { resetAccount, profileGas } = require('./utils/utils');

const HMooniswap = artifacts.require('HMooniswap');
const Registry = artifacts.require('Registry');
const Proxy = artifacts.require('ProxyMock');
const IToken = artifacts.require('IERC20');
const IMoonPool = artifacts.require('IMooniswap');

contract('Mooniswap', function([_, deployer, user, someone]) {
  const tokenAAddress = YFI_TOKEN;
  const tokenBAddress = DAI_TOKEN;
  const tokenAProviderAddress = YFI_PROVIDER;
  const tokenBProviderAddress = DAI_PROVIDER;
  const moonPoolAAddress = MOONISWAP_ETH_DAI;
  const moonPoolBAddress = MOONISWAP_YFI_DAI;

  let tokenAUserAmount;
  let tokenBUserAmount;
  let balanceProxy;

  before(async function() {
    this.registry = await Registry.new();
    this.proxy = await Proxy.new(this.registry.address);
    this.HMooniswap = await HMooniswap.new();
    await this.registry.register(
      this.HMooniswap.address,
      utils.asciiToHex('Mooniswap')
    );

    // Setup and transfer token to user
    this.tokenA = await IToken.at(tokenAAddress);
    this.tokenB = await IToken.at(tokenBAddress);
    this.MoonPoolAToken = await IToken.at(moonPoolAAddress);
    this.MoonPoolBToken = await IToken.at(moonPoolBAddress);
    this.MoonPoolA = await IMoonPool.at(moonPoolAAddress);
    this.MoonPoolB = await IMoonPool.at(moonPoolBAddress);

    await this.tokenA.transfer(user, ether('1000'), {
      from: tokenAProviderAddress,
    });

    await this.tokenB.transfer(user, ether('1000'), {
      from: tokenBProviderAddress,
    });
  });

  beforeEach(async function() {
    await resetAccount(_);
    await resetAccount(user);
    this.proxy = await Proxy.new(this.registry.address);
  });

  describe('deposit', function() {
    beforeEach(async function() {
      tokenAUserAmount = await this.tokenA.balanceOf.call(user);
      tokenBUserAmount = await this.tokenB.balanceOf.call(user);
      PoolATokenUserAmount = await this.MoonPoolAToken.balanceOf.call(user);
      PoolBTokenUserAmount = await this.MoonPoolBToken.balanceOf.call(user);
      balanceProxy = await tracker(this.proxy.address);
      balanceUser = await tracker(user);
    });

    it('deposit ETH and Token', async function() {
      // Prepare handler data
      const value = ether('0.1');
      const tokenBAmount = ether('100');
      const to = this.HMooniswap.address;
      const tokens = [constants.ZERO_ADDRESS, this.tokenB.address];
      const amounts = [value, tokenBAmount];
      const minAmounts = [new BN('1'), new BN('1')];
      const data = abi.simpleEncode(
        'deposit(address[],uint256[],uint256[])',
        tokens,
        amounts,
        minAmounts
      );

      // Simulate Mooniswap contract behavior
      await this.tokenB.approve(this.MoonPoolA.address, tokenBAmount, {
        from: user,
      });
      const expectedPoolAmountOut = await this.MoonPoolA.deposit.call(
        amounts,
        minAmounts,
        { from: user, value: value }
      );

      // Send tokens to proxy
      await this.tokenB.transfer(this.proxy.address, tokenBAmount, {
        from: user,
      });
      await this.proxy.updateTokenMock(this.tokenB.address);

      // Execute handler
      balanceUser.get();
      const receipt = await this.proxy.execMock(to, data, {
        from: user,
        value: value,
      });

      // Verify proxy balance should be zero
      expect(await balanceProxy.get()).to.be.bignumber.eq(ether('0'));
      expect(
        await this.tokenB.balanceOf.call(this.proxy.address)
      ).to.be.bignumber.eq(ether('0'));
      expect(
        await this.MoonPoolAToken.balanceOf.call(this.proxy.address)
      ).to.be.bignumber.eq(ether('0'));

      // Verify user balance
      expect(await this.tokenB.balanceOf.call(user)).to.be.bignumber.lte(
        tokenBUserAmount.sub(minAmounts[1])
      );
      expect(await this.MoonPoolAToken.balanceOf.call(user)).to.be.bignumber.eq(
        PoolATokenUserAmount.add(expectedPoolAmountOut)
      );
      expect(await balanceUser.delta()).to.be.bignumber.lte(
        ether('0')
          .sub(minAmounts[1])
          .sub(new BN(receipt.receipt.gasUsed))
      );

      profileGas(receipt);
    });

    it('deposit Token and Token', async function() {
      // Prepare handler data
      const tokenAAmount = ether('10');
      const tokenBAmount = ether('10');
      const to = this.HMooniswap.address;
      const tokens = [this.tokenA.address, this.tokenB.address];
      const amounts = [tokenAAmount, tokenBAmount];
      const minAmounts = [new BN('1'), new BN('1')];
      const data = abi.simpleEncode(
        'deposit(address[],uint256[],uint256[])',
        tokens,
        amounts,
        minAmounts
      );

      // Simulate Mooniswap contract behavior
      await this.tokenA.approve(this.MoonPoolB.address, tokenAAmount, {
        from: user,
      });
      await this.tokenB.approve(this.MoonPoolB.address, tokenBAmount, {
        from: user,
      });
      const expectedPoolAmountOut = await this.MoonPoolB.deposit.call(
        amounts,
        minAmounts,
        { from: user }
      );

      // Send tokens to proxy
      await this.tokenA.transfer(this.proxy.address, tokenAAmount, {
        from: user,
      });
      await this.proxy.updateTokenMock(this.tokenA.address);

      await this.tokenB.transfer(this.proxy.address, tokenBAmount, {
        from: user,
      });
      await this.proxy.updateTokenMock(this.tokenB.address);

      // Execute handler
      balanceUser.get();
      const receipt = await this.proxy.execMock(to, data, {
        from: user,
        value: ether('0.1'),
      });

      // Verify proxy balance should be zero
      expect(await balanceProxy.get()).to.be.bignumber.eq(ether('0'));
      expect(
        await this.tokenA.balanceOf.call(this.proxy.address)
      ).to.be.bignumber.eq(ether('0'));
      expect(
        await this.tokenB.balanceOf.call(this.proxy.address)
      ).to.be.bignumber.eq(ether('0'));
      expect(
        await this.MoonPoolBToken.balanceOf.call(this.proxy.address)
      ).to.be.bignumber.eq(ether('0'));

      // Verify user balance
      expect(await this.tokenA.balanceOf.call(user)).to.be.bignumber.lte(
        tokenAUserAmount.sub(minAmounts[0])
      );
      expect(await this.tokenB.balanceOf.call(user)).to.be.bignumber.lte(
        tokenBUserAmount.sub(minAmounts[1])
      );
      expect(await this.MoonPoolBToken.balanceOf.call(user)).to.be.bignumber.eq(
        PoolBTokenUserAmount.add(expectedPoolAmountOut)
      );
      expect(await balanceUser.delta()).to.be.bignumber.eq(
        ether('0').sub(new BN(receipt.receipt.gasUsed))
      );

      profileGas(receipt);
    });
  });

  describe('withdraw', function() {
    beforeEach(async function() {
      tokenAUserAmount = await this.tokenA.balanceOf.call(user);
      tokenBUserAmount = await this.tokenB.balanceOf.call(user);
      PoolATokenUserAmount = await this.MoonPoolAToken.balanceOf.call(user);
      PoolBTokenUserAmount = await this.MoonPoolBToken.balanceOf.call(user);
      balanceProxy = await tracker(this.proxy.address);
      balanceUser = await tracker(user);
    });

    it('withdraw ETH and Token', async function() {
      // Add pool liquidity
      const value = ether('0.1');
      const tokenBAmount = ether('100');
      const amounts = [value, tokenBAmount];
      const minAmounts = [new BN('1'), new BN('1')];
      await this.tokenB.approve(this.MoonPoolA.address, tokenBAmount, {
        from: user,
      });
      await this.MoonPoolA.deposit(amounts, minAmounts, {
        from: user,
        value: value,
      });
      tokenBUserAmount = await this.tokenB.balanceOf.call(user);
      PoolATokenUserAmount = await this.MoonPoolAToken.balanceOf.call(user);

      // Prepare handler data
      const to = this.HMooniswap.address;
      const amount = await this.MoonPoolAToken.balanceOf.call(user);
      const minReturns = [new BN('1'), new BN('1')];
      const data = abi.simpleEncode(
        'withdraw(address,uint256,uint256[])',
        this.MoonPoolAToken.address,
        amount,
        minReturns
      );

      // Send tokens to proxy
      await this.MoonPoolAToken.transfer(this.proxy.address, amount, {
        from: user,
      });
      await this.proxy.updateTokenMock(moonPoolAAddress);

      // Execute handler
      balanceUser.get();
      const receipt = await this.proxy.execMock(to, data, {
        from: user,
        value: value,
      });

      // Verify proxy balance should be zero
      expect(await balanceProxy.get()).to.be.bignumber.eq(ether('0'));
      expect(
        await this.tokenB.balanceOf.call(this.proxy.address)
      ).to.be.bignumber.eq(ether('0'));
      expect(
        await this.MoonPoolAToken.balanceOf.call(this.proxy.address)
      ).to.be.bignumber.eq(ether('0'));

      // Verify user balance
      expect(await this.tokenB.balanceOf.call(user)).to.be.bignumber.gte(
        tokenBUserAmount.add(minReturns[1])
      );
      expect(await this.MoonPoolAToken.balanceOf.call(user)).to.be.bignumber.eq(
        PoolATokenUserAmount.sub(amount)
      );
      expect(await balanceUser.delta()).to.be.bignumber.gte(
        ether('0')
          .add(minReturns[0])
          .sub(new BN(receipt.receipt.gasUsed))
      );

      profileGas(receipt);
    });

    it('withdraw Token and Token', async function() {
      // Add pool liquidity
      const tokenAAmount = ether('10');
      const tokenBAmount = ether('10');
      const amounts = [tokenAAmount, tokenBAmount];
      const minAmounts = [new BN('1'), new BN('1')];
      await this.tokenA.approve(this.MoonPoolB.address, tokenAAmount, {
        from: user,
      });
      await this.tokenB.approve(this.MoonPoolB.address, tokenBAmount, {
        from: user,
      });
      await this.MoonPoolB.deposit(amounts, minAmounts, {
        from: user,
      });
      tokenAUserAmount = await this.tokenA.balanceOf.call(user);
      tokenBUserAmount = await this.tokenB.balanceOf.call(user);
      PoolBTokenUserAmount = await this.MoonPoolBToken.balanceOf.call(user);

      // Prepare handler data
      const to = this.HMooniswap.address;
      const amount = await this.MoonPoolBToken.balanceOf.call(user);
      const minReturns = [new BN('1'), new BN('1')];
      const data = abi.simpleEncode(
        'withdraw(address,uint256,uint256[])',
        this.MoonPoolBToken.address,
        amount,
        minReturns
      );

      // Send tokens to proxy
      await this.MoonPoolBToken.transfer(this.proxy.address, amount, {
        from: user,
      });
      await this.proxy.updateTokenMock(moonPoolAAddress);

      // Execute handler
      balanceUser.get();
      const receipt = await this.proxy.execMock(to, data, {
        from: user,
        value: ether('0.1'),
      });

      // Verify proxy balance should be zero
      expect(await balanceProxy.get()).to.be.bignumber.eq(ether('0'));
      expect(
        await this.tokenA.balanceOf.call(this.proxy.address)
      ).to.be.bignumber.eq(ether('0'));
      expect(
        await this.tokenB.balanceOf.call(this.proxy.address)
      ).to.be.bignumber.eq(ether('0'));
      expect(
        await this.MoonPoolBToken.balanceOf.call(this.proxy.address)
      ).to.be.bignumber.eq(ether('0'));

      // Verify user balance
      expect(await this.tokenA.balanceOf.call(user)).to.be.bignumber.gte(
        tokenAUserAmount.add(minReturns[0])
      );
      expect(await this.tokenB.balanceOf.call(user)).to.be.bignumber.gte(
        tokenBUserAmount.add(minReturns[1])
      );
      expect(await this.MoonPoolBToken.balanceOf.call(user)).to.be.bignumber.eq(
        PoolBTokenUserAmount.sub(amount)
      );
      expect(await balanceUser.delta()).to.be.bignumber.gte(
        ether('0').sub(new BN(receipt.receipt.gasUsed))
      );

      profileGas(receipt);
    });
  });
});
