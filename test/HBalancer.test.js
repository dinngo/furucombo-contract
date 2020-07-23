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
const { resetAccount, profileGas } = require('./utils/utils');

const HBalancer = artifacts.require('HBalancer');
const Registry = artifacts.require('Registry');
const Proxy = artifacts.require('ProxyMock');
const IToken = artifacts.require('IERC20');
const IDSProxy = artifacts.require('IDSProxy');
const IDSProxyRegistry = artifacts.require('IDSProxyRegistry');
const IBPool = artifacts.require('IBPool');

contract('Balancer', function([_, deployer, user]) {
  const tokenAAddress = WETH_TOKEN;
  const tokenBAddress = MKR_TOKEN;
  const tokenCAddress = DAI_TOKEN;
  const tokenAProviderAddress = WETH_PROVIDER;
  const tokenBProviderAddress = MKR_PROVIDER;
  const tokenCProviderAddress = DAI_PROVIDER;
  const balancerPoolAddress = BALANCER_WETH_MKR_DAI;

  let tokenAUserAmount;
  let tokenBUserAmount;
  let tokenCUserAmount;
  let balanceProxy;

  before(async function() {
    // Deploy proxy and handler
    this.registry = await Registry.new();
    this.proxy = await Proxy.new(this.registry.address);
    this.HBalancer = await HBalancer.new();
    await this.registry.register(
      this.HBalancer.address,
      utils.asciiToHex('Balancer')
    );
    this.BPool = await IBPool.at(balancerPoolAddress);

    // Create DSProxy of proxy
    this.DSRegistry = await IDSProxyRegistry.at(MAKER_PROXY_REGISTRY);
    await this.DSRegistry.build(this.proxy.address);
    this.DSProxy = await IDSProxy.at(
      await this.DSRegistry.proxies.call(this.proxy.address)
    );

    // Setup and transfer token to user
    this.tokenA = await IToken.at(tokenAAddress);
    this.tokenB = await IToken.at(tokenBAddress);
    this.tokenC = await IToken.at(tokenCAddress);
    this.balancerPoolToken = await IToken.at(balancerPoolAddress);
    await this.tokenA.transfer(user, ether('1000'), {
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
    await resetAccount(_);
    await resetAccount(user);
    balanceProxy = await tracker(this.proxy.address);
    tokenAUserAmount = await this.tokenA.balanceOf.call(user);
    tokenBUserAmount = await this.tokenB.balanceOf.call(user);
    tokenCUserAmount = await this.tokenC.balanceOf.call(user);
    balancerPoolTokenUserAmount = await this.balancerPoolToken.balanceOf.call(
      user
    );
  });

  describe('Liquidity ', function() {
    describe('Add Liquidity Single Assert', function() {
      it('normal', async function() {
        // Prepare handler data
        const tokenAAmount = ether('1');
        const minTokenAAmount = new BN('1');
        const to = this.HBalancer.address;
        const data = abi.simpleEncode(
          'joinswapExternAmountIn(address,address,uint256,uint256)',
          balancerPoolAddress,
          tokenAAddress,
          tokenAAmount,
          minTokenAAmount
        );

        // Simulate Balancer contract behavior
        await this.tokenA.approve(this.BPool.address, tokenAAmount, {
          from: user,
        });
        const exceptedPoolAmountOut = await this.BPool.joinswapExternAmountIn.call(
          tokenAAddress,
          tokenAAmount,
          minTokenAAmount,
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

        // Verify proxy balance should be zero
        expect(await balanceProxy.get()).to.be.bignumber.eq(ether('0'));
        expect(
          await this.tokenA.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.eq(ether('0'));

        // Verify user balance
        expect(await this.tokenA.balanceOf.call(user)).to.be.bignumber.lte(
          tokenAUserAmount.sub(minTokenAAmount)
        );
        expect(
          await this.balancerPoolToken.balanceOf.call(user)
        ).to.be.bignumber.eq(
          balancerPoolTokenUserAmount.add(exceptedPoolAmountOut)
        );

        // Gas profile
        profileGas(receipt);
      });
    });

    describe('Add Liquidity All Asserts', function() {
      it('normal', async function() {
        // Get BPool Information
        const poolTokenABalance = await this.BPool.getBalance.call(
          tokenAAddress
        );
        const poolTokenBBalance = await this.BPool.getBalance.call(
          tokenBAddress
        );
        const poolTokenCBalance = await this.BPool.getBalance.call(
          tokenCAddress
        );
        const poolTotalSupply = await this.BPool.totalSupply.call();

        // Prepare handler data
        const to = this.HBalancer.address;
        const poolAmountPercent = new BN('1000'); // poolAmountPercent is 0.1%
        const poolAmountOut = poolTotalSupply.divRound(poolAmountPercent); // Excepted receive pool token amount

        // Calculate excepted token input amount
        const ratio = getRatio(poolAmountOut, poolTotalSupply);
        const maxTokenAAmount = calcExceptedTokenAmount(
          ratio,
          poolTokenABalance
        );
        const maxTokenBAmount = calcExceptedTokenAmount(
          ratio,
          poolTokenBBalance
        );
        const maxTokenCAmount = calcExceptedTokenAmount(
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
        expect(await this.tokenA.balanceOf.call(user)).to.be.bignumber.lte(
          tokenAUserAmount.sub(maxTokenAAmount)
        );
        expect(await this.tokenB.balanceOf.call(user)).to.be.bignumber.lte(
          tokenBUserAmount.sub(maxTokenBAmount)
        );
        expect(await this.tokenC.balanceOf.call(user)).to.be.bignumber.lte(
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
        const to = this.HBalancer.address;
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
          'token and amount does not match'
        );
      });
    });

    describe('Remove Liquidity Single Assert', function() {
      beforeEach(async function() {
        // Add liquidity before removing liquidity
        const tokenAAmount = ether('1');
        await this.tokenA.approve(this.BPool.address, tokenAAmount, {
          from: user,
        });
        await this.BPool.joinswapExternAmountIn(
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
        const to = this.HBalancer.address;
        const data = abi.simpleEncode(
          'exitswapPoolAmountIn(address,address,uint256,uint256)',
          balancerPoolAddress,
          tokenAAddress,
          poolAmountIn,
          minTokenAAmount
        );

        // Simulate Balancer contract behavior
        const exceptedTokenAmountOut = await this.BPool.exitswapPoolAmountIn.call(
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
          tokenAUserAmount.add(exceptedTokenAmountOut)
        );
        expect(
          await this.balancerPoolToken.balanceOf.call(user)
        ).to.be.bignumber.eq(balancerPoolTokenUserAmount.sub(poolAmountIn));

        // Gas profile
        profileGas(receipt);
      });
    });

    describe('Remove Liquidity All Asserts', function() {
      beforeEach(async function() {
        // Add liquidity before removing liquidity
        const tokenAAmount = ether('10');
        await this.tokenA.approve(this.BPool.address, tokenAAmount, {
          from: user,
        });
        await this.BPool.joinswapExternAmountIn(
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
        const poolTokenABalance = await this.BPool.getBalance.call(
          tokenAAddress
        );
        const poolTokenBBalance = await this.BPool.getBalance.call(
          tokenBAddress
        );
        const poolTokenCBalance = await this.BPool.getBalance.call(
          tokenCAddress
        );
        const poolTotalSupply = await this.BPool.totalSupply.call();

        // Prepare handler data
        const poolAmountPercent = new BN('100'); // poolAmountPercent is 1%
        const poolAmountIn = balancerPoolTokenUserAmount.divRound(
          poolAmountPercent
        );
        const minAmountsOut = [ether('0'), ether('0'), ether('0')];
        const to = this.HBalancer.address;
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

        // Calculate excepted token output amount
        const ratio = getRatio(poolAmountIn, poolTotalSupply);
        const exceptedTokenAAmountOut = calcExceptedTokenAmount(
          ratio,
          poolTokenABalance
        );
        const exceptedTokenBAmountOut = calcExceptedTokenAmount(
          ratio,
          poolTokenBBalance
        );
        const exceptedTokenCAmountOut = calcExceptedTokenAmount(
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
          tokenAUserAmount.add(exceptedTokenAAmountOut)
        );
        expect(await this.tokenB.balanceOf.call(user)).to.be.bignumber.eq(
          tokenBUserAmount.add(exceptedTokenBAmountOut)
        );
        expect(await this.tokenC.balanceOf.call(user)).to.be.bignumber.eq(
          tokenCUserAmount.add(exceptedTokenCAmountOut)
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
        const to = this.HBalancer.address;
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
          'token and amount does not match'
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

function calcExceptedTokenAmount(ratio, poolTokenBalance) {
  const BONE = ether('1');
  return ratio
    .mul(poolTokenBalance)
    .add(BONE.div(new BN('2')))
    .div(BONE);
}
