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
  WETH_TOKEN,
  MKR_TOKEN,
  DAI_TOKEN,
  WETH_PROVIDER,
  DAI_PROVIDER,
  MKR_PROVIDER,
  BALANCER_WETH_MKR_DAI,
  MAKER_PROXY_REGISTRY,
} = require('./utils/constants');
const {
  evmRevert,
  evmSnapshot,
  profileGas,
  getHandlerReturn,
} = require('./utils/utils');

const HBalancer = artifacts.require('HBalancer');
const Registry = artifacts.require('Registry');
const Proxy = artifacts.require('ProxyMock');
const IToken = artifacts.require('IERC20');
const IDSProxy = artifacts.require('IDSProxy');
const IDSProxyRegistry = artifacts.require('IDSProxyRegistry');
const IBPool = artifacts.require('IBPool');

contract('Balancer', function([_, user]) {
  const tokenAAddress = WETH_TOKEN;
  const tokenBAddress = MKR_TOKEN;
  const tokenCAddress = DAI_TOKEN;
  const tokenAProviderAddress = WETH_PROVIDER;
  const tokenBProviderAddress = MKR_PROVIDER;
  const tokenCProviderAddress = DAI_PROVIDER;
  const balancerPoolAddress = BALANCER_WETH_MKR_DAI;

  let id;
  let tokenAUserAmount;
  let tokenBUserAmount;
  let tokenCUserAmount;
  let balanceProxy;

  before(async function() {
    // Deploy proxy and handler
    this.registry = await Registry.new();
    this.proxy = await Proxy.new(this.registry.address);
    this.hBalancer = await HBalancer.new();
    await this.registry.register(
      this.hBalancer.address,
      utils.asciiToHex('Balancer')
    );
    this.bPool = await IBPool.at(balancerPoolAddress);

    // Create DSProxy of proxy
    this.dsRegistry = await IDSProxyRegistry.at(MAKER_PROXY_REGISTRY);
    await this.dsRegistry.build(this.proxy.address);
    this.DSProxy = await IDSProxy.at(
      await this.dsRegistry.proxies.call(this.proxy.address)
    );

    // Setup and transfer token to user
    this.tokenA = await IToken.at(tokenAAddress);
    this.tokenB = await IToken.at(tokenBAddress);
    this.tokenC = await IToken.at(tokenCAddress);
    this.balancerPoolToken = await IToken.at(balancerPoolAddress);
    await this.tokenA.transfer(user, ether('10'), {
      from: tokenAProviderAddress,
    });
    await this.tokenB.transfer(user, ether('1000'), {
      from: tokenBProviderAddress,
    });
    await this.tokenC.transfer(user, ether('1000'), {
      from: tokenCProviderAddress,
    });
  });

  beforeEach(async function() {
    id = await evmSnapshot();
    balanceProxy = await tracker(this.proxy.address);
    tokenAUserAmount = await this.tokenA.balanceOf.call(user);
    tokenBUserAmount = await this.tokenB.balanceOf.call(user);
    tokenCUserAmount = await this.tokenC.balanceOf.call(user);
    balancerPoolTokenUserAmount = await this.balancerPoolToken.balanceOf.call(
      user
    );
  });

  afterEach(async function() {
    await evmRevert(id);
  });

  describe('Liquidity ', function() {
    describe('Add Liquidity Single Asset', function() {
      it('normal', async function() {
        // Prepare handler data
        const tokenAAmount = ether('1');
        const minPoolAmountOut = new BN('1');
        const to = this.hBalancer.address;
        const data = abi.simpleEncode(
          'joinswapExternAmountIn(address,address,uint256,uint256)',
          balancerPoolAddress,
          tokenAAddress,
          tokenAAmount,
          minPoolAmountOut
        );
        // Simulate Balancer contract behavior
        await this.tokenA.approve(this.bPool.address, tokenAAmount, {
          from: user,
        });
        const expectedPoolAmountOut = await this.bPool.joinswapExternAmountIn.call(
          tokenAAddress,
          tokenAAmount,
          minPoolAmountOut,
          { from: user }
        );
        // Send tokens to proxy
        await this.tokenA.transfer(this.proxy.address, tokenAAmount, {
          from: user,
        });
        await this.proxy.updateTokenMock(this.tokenA.address);
        // Execute handler
        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: ether('0.1'),
        });
        // Get handler return result
        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );
        // Verify handler return amount
        expect(handlerReturn).to.be.bignumber.eq(expectedPoolAmountOut);
        // Verify proxy balance should be zero
        expect(await balanceProxy.get()).to.be.bignumber.eq(ether('0'));
        expect(
          await this.tokenA.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.eq(ether('0'));
        // Verify user balance
        expect(await this.tokenA.balanceOf.call(user)).to.be.bignumber.eq(
          tokenAUserAmount.sub(tokenAAmount)
        );
        expect(
          await this.balancerPoolToken.balanceOf.call(user)
        ).to.be.bignumber.eq(
          balancerPoolTokenUserAmount.add(expectedPoolAmountOut)
        );
        // Gas profile
        profileGas(receipt);
      });
    });

    describe('Add Liquidity All Assets', function() {
      it('normal', async function() {
        // Get BPool Information
        const poolTokenABalance = await this.bPool.getBalance.call(
          tokenAAddress
        );
        const poolTokenBBalance = await this.bPool.getBalance.call(
          tokenBAddress
        );
        const poolTokenCBalance = await this.bPool.getBalance.call(
          tokenCAddress
        );
        const poolTotalSupply = await this.bPool.totalSupply.call();
        // Prepare handler data
        const to = this.hBalancer.address;
        const poolAmountPercent = new BN('1000'); // poolAmountPercent is 0.1%
        const poolAmountOut = poolTotalSupply.divRound(poolAmountPercent); // Expected receive pool token amount
        // Calculate expected token input amount
        const ratio = getRatio(poolAmountOut, poolTotalSupply);
        const maxTokenAAmount = calcExpectedTokenAmount(
          ratio,
          poolTokenABalance
        );
        const maxTokenBAmount = calcExpectedTokenAmount(
          ratio,
          poolTokenBBalance
        );
        const maxTokenCAmount = calcExpectedTokenAmount(
          ratio,
          poolTokenCBalance
        );
        const maxAmountsIn = [
          maxTokenAAmount,
          maxTokenBAmount,
          maxTokenCAmount,
        ];
        // Encode handler data
        const data = abi.simpleEncode(
          'joinPool(address,uint256,uint256[])',
          balancerPoolAddress,
          poolAmountOut,
          maxAmountsIn
        );
        // Send tokens from user to proxy
        await this.tokenA.transfer(this.proxy.address, maxTokenAAmount, {
          from: user,
        });
        await this.tokenB.transfer(this.proxy.address, maxTokenBAmount, {
          from: user,
        });
        await this.tokenC.transfer(this.proxy.address, maxTokenCAmount, {
          from: user,
        });
        await this.proxy.updateTokenMock(this.tokenA.address);
        await this.proxy.updateTokenMock(this.tokenB.address);
        await this.proxy.updateTokenMock(this.tokenC.address);
        // Execute handler
        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: ether('0.1'),
        });

        const handlerReturn = getHandlerReturn(receipt, ['uint256[]'])[0];
        const tokenAUserAmountEnd = await this.tokenA.balanceOf.call(user);
        const tokenBUserAmountEnd = await this.tokenB.balanceOf.call(user);
        const tokenCUserAmountEnd = await this.tokenC.balanceOf.call(user);
        expect(utils.toBN(handlerReturn[0])).to.be.bignumber.eq(
          tokenAUserAmount.sub(tokenAUserAmountEnd)
        );
        expect(utils.toBN(handlerReturn[1])).to.be.bignumber.eq(
          tokenBUserAmount.sub(tokenBUserAmountEnd)
        );
        expect(utils.toBN(handlerReturn[2])).to.be.bignumber.eq(
          tokenCUserAmount.sub(tokenCUserAmountEnd)
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
          await this.tokenC.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.eq(ether('0'));
        // Verify user balance
        expect(tokenAUserAmountEnd).to.be.bignumber.lte(
          tokenAUserAmount.sub(maxTokenAAmount)
        );
        expect(tokenBUserAmountEnd).to.be.bignumber.lte(
          tokenBUserAmount.sub(maxTokenBAmount)
        );
        expect(tokenCUserAmountEnd).to.be.bignumber.lte(
          tokenCUserAmount.sub(maxTokenCAmount)
        );
        expect(
          await this.balancerPoolToken.balanceOf.call(user)
        ).to.be.bignumber.eq(balancerPoolTokenUserAmount.add(poolAmountOut));
        // Gas profile
        profileGas(receipt);
      });

      it('Amounts not match', async function() {
        // Prepare handler data
        const to = this.hBalancer.address;
        const poolAmountOut = new BN('100000');
        const maxAmountsIn = [new BN('100'), new BN('100')];
        // Encode handler data
        const data = abi.simpleEncode(
          'joinPool(address,uint256,uint256[])',
          balancerPoolAddress,
          poolAmountOut,
          maxAmountsIn
        );
        // Execute handler
        await expectRevert(
          this.proxy.execMock(to, data, {
            from: user,
            value: ether('0.1'),
          }),
          'HBalancer_joinPool: token and amount does not match'
        );
      });
    });

    describe('Remove Liquidity Single Asset', function() {
      beforeEach(async function() {
        // Add liquidity before removing liquidity
        const tokenAAmount = ether('1');
        await this.tokenA.approve(this.bPool.address, tokenAAmount, {
          from: user,
        });
        await this.bPool.joinswapExternAmountIn(
          tokenAAddress,
          tokenAAmount,
          new BN('1'),
          { from: user }
        );
        // Update token amount
        balancerPoolTokenUserAmount = await this.balancerPoolToken.balanceOf.call(
          user
        );
        tokenAUserAmount = await this.tokenA.balanceOf.call(user);
      });
      it('normal', async function() {
        // Prepare handler data
        const poolAmountIn = balancerPoolTokenUserAmount.divRound(new BN('10'));
        const minTokenAAmount = ether('0');
        const to = this.hBalancer.address;
        const data = abi.simpleEncode(
          'exitswapPoolAmountIn(address,address,uint256,uint256)',
          balancerPoolAddress,
          tokenAAddress,
          poolAmountIn,
          minTokenAAmount
        );
        // Simulate Balancer contract behavior
        const expectedTokenAmountOut = await this.bPool.exitswapPoolAmountIn.call(
          tokenAAddress,
          poolAmountIn,
          minTokenAAmount,
          { from: user }
        );
        // Send token to proxy
        await this.balancerPoolToken.transfer(
          this.proxy.address,
          poolAmountIn,
          {
            from: user,
          }
        );
        await this.proxy.updateTokenMock(this.tokenA.address);
        // Execute handler
        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: ether('0.1'),
        });

        // Get handler return result
        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );
        expect(handlerReturn).to.be.bignumber.eq(expectedTokenAmountOut);

        // Verify proxy balance should be zero
        expect(await balanceProxy.get()).to.be.bignumber.eq(ether('0'));
        expect(
          await this.tokenA.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.eq(ether('0'));
        expect(
          await this.balancerPoolToken.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.eq(ether('0'));
        // Verify user balance
        expect(await this.tokenA.balanceOf.call(user)).to.be.bignumber.eq(
          tokenAUserAmount.add(expectedTokenAmountOut)
        );
        expect(
          await this.balancerPoolToken.balanceOf.call(user)
        ).to.be.bignumber.eq(balancerPoolTokenUserAmount.sub(poolAmountIn));
        // Gas profile
        profileGas(receipt);
      });
    });
    describe('Remove Liquidity All Assets', function() {
      beforeEach(async function() {
        // Add liquidity before removing liquidity
        const tokenAAmount = ether('10');
        await this.tokenA.approve(this.bPool.address, tokenAAmount, {
          from: user,
        });
        await this.bPool.joinswapExternAmountIn(
          tokenAAddress,
          tokenAAmount,
          new BN('1'),
          { from: user }
        );
        balancerPoolTokenUserAmount = await this.balancerPoolToken.balanceOf.call(
          user
        );
        tokenAUserAmount = await this.tokenA.balanceOf.call(user);
        tokenBUserAmount = await this.tokenB.balanceOf.call(user);
        tokenCUserAmount = await this.tokenC.balanceOf.call(user);
      });
      it('normal', async function() {
        // Get BPool Information
        const poolTokenABalance = await this.bPool.getBalance.call(
          tokenAAddress
        );
        const poolTokenBBalance = await this.bPool.getBalance.call(
          tokenBAddress
        );
        const poolTokenCBalance = await this.bPool.getBalance.call(
          tokenCAddress
        );
        const poolTotalSupply = await this.bPool.totalSupply.call();
        // Prepare handler data
        const poolAmountPercent = new BN('100'); // poolAmountPercent is 1%
        const poolAmountIn = balancerPoolTokenUserAmount.divRound(
          poolAmountPercent
        );
        const minAmountsOut = [ether('0'), ether('0'), ether('0')];
        const to = this.hBalancer.address;
        const data = abi.simpleEncode(
          'exitPool(address,uint256,uint256[])',
          balancerPoolAddress,
          poolAmountIn,
          minAmountsOut
        );
        // Send tokens to proxy
        await this.balancerPoolToken.transfer(
          this.proxy.address,
          poolAmountIn,
          {
            from: user,
          }
        );
        await this.proxy.updateTokenMock(this.tokenA.address);
        // Execute handler
        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: ether('0.1'),
        });

        const handlerReturn = getHandlerReturn(receipt, ['uint256[]'])[0];
        const tokenAUserAmountEnd = await this.tokenA.balanceOf.call(user);
        const tokenBUserAmountEnd = await this.tokenB.balanceOf.call(user);
        const tokenCUserAmountEnd = await this.tokenC.balanceOf.call(user);

        // Check handler return
        expect(utils.toBN(handlerReturn[0])).to.be.bignumber.eq(
          tokenAUserAmountEnd.sub(tokenAUserAmount)
        );

        expect(utils.toBN(handlerReturn[1])).to.be.bignumber.eq(
          tokenBUserAmountEnd.sub(tokenBUserAmount)
        );
        expect(utils.toBN(handlerReturn[2])).to.be.bignumber.eq(
          tokenCUserAmountEnd.sub(tokenCUserAmount)
        );

        // Calculate expected token output amount
        const ratio = getRatio(poolAmountIn, poolTotalSupply);
        const expectedTokenAAmountOut = calcExpectedTokenAmount(
          ratio,
          poolTokenABalance
        );
        const expectedTokenBAmountOut = calcExpectedTokenAmount(
          ratio,
          poolTokenBBalance
        );
        const expectedTokenCAmountOut = calcExpectedTokenAmount(
          ratio,
          poolTokenCBalance
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
          await this.tokenC.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.eq(ether('0'));
        expect(
          await this.balancerPoolToken.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.eq(ether('0'));
        // Verify user token balance
        expect(await this.tokenA.balanceOf.call(user)).to.be.bignumber.eq(
          tokenAUserAmount.add(expectedTokenAAmountOut)
        );
        expect(await this.tokenB.balanceOf.call(user)).to.be.bignumber.eq(
          tokenBUserAmount.add(expectedTokenBAmountOut)
        );
        expect(await this.tokenC.balanceOf.call(user)).to.be.bignumber.eq(
          tokenCUserAmount.add(expectedTokenCAmountOut)
        );
        expect(
          await this.balancerPoolToken.balanceOf.call(user)
        ).to.be.bignumber.eq(balancerPoolTokenUserAmount.sub(poolAmountIn));
        // Gas profile
        profileGas(receipt);
      });
      it('Amounts not match', async function() {
        // Prepare handler data
        const poolAmountPercent = new BN('100'); // poolAmountPercent is 1%
        const poolAmountIn = balancerPoolTokenUserAmount.divRound(
          poolAmountPercent
        );
        const minAmountsOut = [ether('0'), ether('0')];
        const to = this.hBalancer.address;
        const data = abi.simpleEncode(
          'exitPool(address,uint256,uint256[])',
          balancerPoolAddress,
          poolAmountIn,
          minAmountsOut
        );
        // Execute handler
        await expectRevert(
          this.proxy.execMock(to, data, {
            from: user,
            value: ether('0.1'),
          }),
          'HBalancer_exitPool: token and amount does not match'
        );
      });
    });
  });
});

function getRatio(poolAmountIn, totalSupply) {
  const BONE = ether('1');
  var ratio = poolAmountIn
    .mul(BONE)
    .add(totalSupply.div(new BN('2')))
    .div(totalSupply);
  return ratio;
}

function calcExpectedTokenAmount(ratio, poolTokenBalance) {
  const BONE = ether('1');
  return ratio
    .mul(poolTokenBalance)
    .add(BONE.div(new BN('2')))
    .div(BONE);
}
