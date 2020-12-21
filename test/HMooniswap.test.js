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
const {
  evmRevert,
  evmSnapshot,
  profileGas,
  getHandlerReturn,
} = require('./utils/utils');

const HMooniswap = artifacts.require('HMooniswap');
const Registry = artifacts.require('Registry');
const Proxy = artifacts.require('ProxyMock');
const IToken = artifacts.require('IERC20');
const IMoonPool = artifacts.require('IMooniswap');

contract('Mooniswap', function([_, user]) {
  let id;
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
    this.hMooniswap = await HMooniswap.new();
    await this.registry.register(
      this.hMooniswap.address,
      utils.asciiToHex('Mooniswap')
    );
    this.proxy = await Proxy.new(this.registry.address);

    // Setup and transfer token to user
    this.tokenA = await IToken.at(tokenAAddress);
    this.tokenB = await IToken.at(tokenBAddress);
    this.moonPoolAToken = await IToken.at(moonPoolAAddress);
    this.moonPoolBToken = await IToken.at(moonPoolBAddress);
    this.moonPoolA = await IMoonPool.at(moonPoolAAddress);
    this.moonPoolB = await IMoonPool.at(moonPoolBAddress);
    console.log(tokenAProviderAddress);
    console.log(
      (await this.tokenA.balanceOf(tokenAProviderAddress)).toString()
    );

    await this.tokenA.transfer(user, ether('900'), {
      from: tokenAProviderAddress,
    });
    await this.tokenB.transfer(user, ether('900'), {
      from: tokenBProviderAddress,
    });
  });

  beforeEach(async function() {
    id = await evmSnapshot();
  });

  afterEach(async function() {
    await evmRevert(id);
  });

  describe('deposit', function() {
    beforeEach(async function() {
      tokenAUserAmount = await this.tokenA.balanceOf.call(user);
      tokenBUserAmount = await this.tokenB.balanceOf.call(user);
      PoolATokenUserAmount = await this.moonPoolAToken.balanceOf.call(user);
      PoolBTokenUserAmount = await this.moonPoolBToken.balanceOf.call(user);
      balanceProxy = await tracker(this.proxy.address);
      balanceUser = await tracker(user);
    });

    it('deposit ETH and Token', async function() {
      // Prepare handler data
      const value = ether('0.1');
      const tokenBAmount = ether('100');
      const to = this.hMooniswap.address;
      const tokens = [constants.ZERO_ADDRESS, this.tokenB.address];
      const amounts = [value, tokenBAmount];
      const minAmounts = [new BN('1'), new BN('1')];
      const data = abi.simpleEncode(
        'deposit(address[2],uint256[],uint256[]):(uint256)',
        tokens,
        amounts,
        minAmounts
      );

      // Simulate Mooniswap contract behavior
      await this.tokenB.approve(this.moonPoolA.address, tokenBAmount, {
        from: user,
      });
      const expectedPoolAmountOut = await this.moonPoolA.deposit.call(
        amounts,
        minAmounts,
        {
          from: user,
          value: value,
        }
      );

      // Send tokens to proxy
      await this.tokenB.transfer(this.proxy.address, tokenBAmount, {
        from: user,
      });
      await this.proxy.updateTokenMock(this.tokenB.address);

      // Execute handler
      await balanceUser.get();
      const receipt = await this.proxy.execMock(to, data, {
        from: user,
        value: value,
      });

      // Get handler return result
      const handlerReturn = utils.toBN(
        getHandlerReturn(receipt, ['uint256'])[0]
      );
      expect(handlerReturn).to.be.bignumber.eq(expectedPoolAmountOut);

      // Verify proxy balance should be zero
      expect(await balanceProxy.get()).to.be.bignumber.eq(ether('0'));
      expect(
        await this.tokenB.balanceOf.call(this.proxy.address)
      ).to.be.bignumber.eq(ether('0'));
      expect(
        await this.moonPoolAToken.balanceOf.call(this.proxy.address)
      ).to.be.bignumber.eq(ether('0'));

      // Verify user balance
      expect(await this.tokenB.balanceOf.call(user)).to.be.bignumber.lte(
        tokenBUserAmount.sub(minAmounts[1])
      );
      expect(await this.moonPoolAToken.balanceOf.call(user)).to.be.bignumber.eq(
        PoolATokenUserAmount.add(expectedPoolAmountOut)
      );
      expect(await balanceUser.delta()).to.be.bignumber.lte(
        ether('0')
          .sub(minAmounts[0])
          .sub(new BN(receipt.receipt.gasUsed))
      );

      profileGas(receipt);
    });

    it('deposit Token and Token', async function() {
      // Prepare handler data
      const tokenAAmount = ether('10');
      const tokenBAmount = ether('10');
      const to = this.hMooniswap.address;
      const tokens = [this.tokenA.address, this.tokenB.address];
      const amounts = [tokenAAmount, tokenBAmount];
      const minAmounts = [new BN('1'), new BN('1')];
      const data = abi.simpleEncode(
        'deposit(address[2],uint256[],uint256[]):(uint256)',
        tokens,
        amounts,
        minAmounts
      );

      // Simulate Mooniswap contract behavior
      await this.tokenA.approve(this.moonPoolB.address, tokenAAmount, {
        from: user,
      });
      await this.tokenB.approve(this.moonPoolB.address, tokenBAmount, {
        from: user,
      });
      const expectedPoolAmountOut = await this.moonPoolB.deposit.call(
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
      await balanceUser.get();
      const receipt = await this.proxy.execMock(to, data, {
        from: user,
        value: ether('0.1'),
      });

      // Get handler return result
      const handlerReturn = utils.toBN(
        getHandlerReturn(receipt, ['uint256'])[0]
      );
      expect(handlerReturn).to.be.bignumber.eq(expectedPoolAmountOut);

      // Verify proxy balance should be zero
      expect(await balanceProxy.get()).to.be.bignumber.eq(ether('0'));
      expect(
        await this.tokenA.balanceOf.call(this.proxy.address)
      ).to.be.bignumber.eq(ether('0'));
      expect(
        await this.tokenB.balanceOf.call(this.proxy.address)
      ).to.be.bignumber.eq(ether('0'));
      expect(
        await this.moonPoolBToken.balanceOf.call(this.proxy.address)
      ).to.be.bignumber.eq(ether('0'));

      // Verify user balance
      expect(await this.tokenA.balanceOf.call(user)).to.be.bignumber.lte(
        tokenAUserAmount.sub(minAmounts[0])
      );
      expect(await this.tokenB.balanceOf.call(user)).to.be.bignumber.lte(
        tokenBUserAmount.sub(minAmounts[1])
      );
      expect(await this.moonPoolBToken.balanceOf.call(user)).to.be.bignumber.eq(
        PoolBTokenUserAmount.add(expectedPoolAmountOut)
      );
      expect(await balanceUser.delta()).to.be.bignumber.eq(
        ether('0').sub(new BN(receipt.receipt.gasUsed))
      );

      profileGas(receipt);
    });

    it('deposit the same tokens', async function() {
      // Prepare handler data
      const value = ether('0.1');
      const to = this.hMooniswap.address;
      const tokens = [constants.ZERO_ADDRESS, constants.ZERO_ADDRESS];
      const amounts = [value, value];
      const minAmounts = [new BN('1'), new BN('1')];
      const data = abi.simpleEncode(
        'deposit(address[2],uint256[],uint256[]):(uint256)',
        tokens,
        amounts,
        minAmounts
      );

      // Execute handler
      await expectRevert(
        this.proxy.execMock(to, data, {
          from: user,
          value: amounts[0].add(amounts[1]),
        }),
        'HMooniswap_deposit: same tokens'
      );
    });

    it('deposit wrong tokens length', async function() {
      // Prepare handler data
      const value = ether('0.1');
      const tokenBAmount = ether('100');
      const to = this.hMooniswap.address;
      const tokens = [constants.ZERO_ADDRESS, this.tokenB.address];
      const amounts = [value, tokenBAmount, new BN('1')];
      const minAmounts = [new BN('1'), new BN('1'), new BN('1')];
      const data = abi.simpleEncode(
        'deposit(address[2],uint256[],uint256[]):(uint256)',
        tokens,
        amounts,
        minAmounts
      );

      // Execute handler
      await expectRevert(
        this.proxy.execMock(to, data, { from: user, value: value }),
        'HMooniswap_deposit: wrong amounts length'
      );
    });

    it('deposit wrong tokens order', async function() {
      // Prepare handler data
      const value = ether('0.1');
      const tokenBAmount = ether('100');
      const to = this.hMooniswap.address;
      const tokens = [this.tokenB.address, constants.ZERO_ADDRESS];
      const amounts = [tokenBAmount, value];
      const minAmounts = [new BN('1'), new BN('1')];
      const data = abi.simpleEncode(
        'deposit(address[2],uint256[],uint256[]):(uint256)',
        tokens,
        amounts,
        minAmounts
      );

      // Execute handler
      await expectRevert(
        this.proxy.execMock(to, data, {
          from: user,
          value: value,
        }),
        'HMooniswap_deposit: wrong tokens order'
      );
    });
  });

  describe('withdraw', function() {
    beforeEach(async function() {
      tokenAUserAmount = await this.tokenA.balanceOf.call(user);
      tokenBUserAmount = await this.tokenB.balanceOf.call(user);
      PoolATokenUserAmount = await this.moonPoolAToken.balanceOf.call(user);
      PoolBTokenUserAmount = await this.moonPoolBToken.balanceOf.call(user);
      balanceProxy = await tracker(this.proxy.address);
      balanceUser = await tracker(user);
    });

    it('withdraw ETH and Token', async function() {
      // Add pool liquidity
      const value = ether('0.1');
      const tokenBAmount = ether('100');
      const amounts = [value, tokenBAmount];
      const minAmounts = [new BN('1'), new BN('1')];
      await this.tokenB.approve(this.moonPoolA.address, tokenBAmount, {
        from: user,
      });
      await this.moonPoolA.deposit(amounts, minAmounts, {
        from: user,
        value: value,
      });
      tokenBUserAmount = await this.tokenB.balanceOf.call(user);
      PoolATokenUserAmount = await this.moonPoolAToken.balanceOf.call(user);

      // Prepare handler data
      const to = this.hMooniswap.address;
      const amount = await this.moonPoolAToken.balanceOf.call(user);
      const minReturns = [new BN('1'), new BN('1')];
      const data = abi.simpleEncode(
        'withdraw(address,uint256,uint256[])',
        this.moonPoolAToken.address,
        amount,
        minReturns
      );

      // Send tokens to proxy
      await this.moonPoolAToken.transfer(this.proxy.address, amount, {
        from: user,
      });
      await this.proxy.updateTokenMock(moonPoolAAddress);

      // Execute handler
      await balanceUser.get();
      const receipt = await this.proxy.execMock(to, data, {
        from: user,
        value: value,
      });

      // Get handler return result
      const handlerReturn = getHandlerReturn(receipt, ['uint256[]'])[0];
      const userTokenBAmountEnd = await this.tokenB.balanceOf.call(user);
      const balanceDelta = await balanceUser.delta();
      expect(balanceDelta).to.be.bignumber.eq(
        utils.toBN(handlerReturn[0]).sub(new BN(receipt.receipt.gasUsed))
      );
      expect(utils.toBN(handlerReturn[1])).to.be.bignumber.eq(
        userTokenBAmountEnd.sub(tokenBUserAmount)
      );

      // Verify proxy balance should be zero
      expect(await balanceProxy.get()).to.be.bignumber.eq(ether('0'));
      expect(
        await this.tokenB.balanceOf.call(this.proxy.address)
      ).to.be.bignumber.eq(ether('0'));
      expect(
        await this.moonPoolAToken.balanceOf.call(this.proxy.address)
      ).to.be.bignumber.eq(ether('0'));

      // Verify user balance
      expect(await this.tokenB.balanceOf.call(user)).to.be.bignumber.gte(
        tokenBUserAmount.add(minReturns[1])
      );
      expect(await this.moonPoolAToken.balanceOf.call(user)).to.be.bignumber.eq(
        PoolATokenUserAmount.sub(amount)
      );
      expect(balanceDelta).to.be.bignumber.gte(
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
      await this.tokenA.approve(this.moonPoolB.address, tokenAAmount, {
        from: user,
      });
      await this.tokenB.approve(this.moonPoolB.address, tokenBAmount, {
        from: user,
      });
      await this.moonPoolB.deposit(amounts, minAmounts, {
        from: user,
      });
      tokenAUserAmount = await this.tokenA.balanceOf.call(user);
      tokenBUserAmount = await this.tokenB.balanceOf.call(user);
      PoolBTokenUserAmount = await this.moonPoolBToken.balanceOf.call(user);

      // Prepare handler data
      const to = this.hMooniswap.address;
      const amount = await this.moonPoolBToken.balanceOf.call(user);
      const minReturns = [new BN('1'), new BN('1')];
      const data = abi.simpleEncode(
        'withdraw(address,uint256,uint256[])',
        this.moonPoolBToken.address,
        amount,
        minReturns
      );

      // Send tokens to proxy
      await this.moonPoolBToken.transfer(this.proxy.address, amount, {
        from: user,
      });
      await this.proxy.updateTokenMock(moonPoolBAddress);

      // Execute handler
      await balanceUser.get();
      const receipt = await this.proxy.execMock(to, data, {
        from: user,
        value: ether('0.1'),
      });

      // Get handler return result
      const handlerReturn = getHandlerReturn(receipt, ['uint256[]'])[0];
      const userTokenBAmountEnd = await this.tokenB.balanceOf.call(user);
      const userTokenAAmountEnd = await this.tokenA.balanceOf.call(user);

      expect(utils.toBN(handlerReturn[0])).to.be.bignumber.eq(
        userTokenAAmountEnd.sub(tokenAUserAmount)
      );
      expect(utils.toBN(handlerReturn[1])).to.be.bignumber.eq(
        userTokenBAmountEnd.sub(tokenBUserAmount)
      );

      // Verify proxy balance should be zero
      expect(await balanceProxy.get()).to.be.bignumber.eq(ether('0'));
      expect(
        await this.tokenA.balanceOf.call(this.proxy.address)
      ).to.be.bignumber.eq(ether('0'));
      expect(
        await this.tokenB.balanceOf.call(this.proxy.address)
      ).to.be.bignumber.eq(ether('0'));
      expect(
        await this.moonPoolBToken.balanceOf.call(this.proxy.address)
      ).to.be.bignumber.eq(ether('0'));

      // Verify user balance
      expect(await this.tokenA.balanceOf.call(user)).to.be.bignumber.gte(
        tokenAUserAmount.add(minReturns[0])
      );
      expect(await this.tokenB.balanceOf.call(user)).to.be.bignumber.gte(
        tokenBUserAmount.add(minReturns[1])
      );
      expect(await this.moonPoolBToken.balanceOf.call(user)).to.be.bignumber.eq(
        PoolBTokenUserAmount.sub(amount)
      );
      expect(await balanceUser.delta()).to.be.bignumber.gte(
        ether('0').sub(new BN(receipt.receipt.gasUsed))
      );

      profileGas(receipt);
    });
  });
});
