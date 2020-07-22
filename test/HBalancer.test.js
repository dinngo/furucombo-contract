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

  let balanceUser;
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
    this.iBPool = await IBPool.at(balancerPoolAddress);

    // Create DSProxy of proxy
    this.dsregistry = await IDSProxyRegistry.at(MAKER_PROXY_REGISTRY);
    await this.dsregistry.build(this.proxy.address);
    this.dsproxy = await IDSProxy.at(
      await this.dsregistry.proxies.call(this.proxy.address)
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
    balanceUser = await tracker(user);
    balanceProxy = await tracker(this.proxy.address);
    tokenAUserAmount = await this.tokenA.balanceOf.call(user);
    tokenBUserAmount = await this.tokenB.balanceOf.call(user);
    tokenCUserAmount = await this.tokenC.balanceOf.call(user);
    balancerPoolTokenUserAmount = await this.balancerPoolToken.balanceOf.call(
      user
    );
  });

  describe('Liqudiity ', function() {
    describe('Add Liqudiity Single Assert', function() {
      beforeEach(async function() {
        // Send tokens to proxy
        await this.tokenA.transfer(this.proxy.address, ether('100'), {
          from: user,
        });

        // Add tokens to cache for return user after handler execution
        await this.proxy.updateTokenMock(this.tokenA.address);
      });

      it('normal', async function() {
        // Prepare handler data
        const tokenAAmount = ether('1');
        const minTokenAAmount = ether('0.000000000000000001');
        const to = this.hBalancer.address;
        const data = abi.simpleEncode(
          'joinswapExternAmountIn(address,address,uint256,uint256)',
          balancerPoolAddress,
          tokenAAddress,
          tokenAAmount,
          minTokenAAmount
        );

        // Simulate Balancer contract behavior
        await this.tokenA.approve(this.iBPool.address, tokenAAmount, {
          from: user,
        });
        const exceptedPoolAmountOut = await this.iBPool.joinswapExternAmountIn.call(
          tokenAAddress,
          tokenAAmount,
          minTokenAAmount,
          { from: user }
        );

        // Execute handler
        const receipt = await this.proxy.execMock(to, data, {
          from: user,
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

    describe('Add Liqudiity All Asserts', function() {
      beforeEach(async function() {
        // Send tokens to proxy
        await this.tokenA.transfer(this.proxy.address, ether('100'), {
          from: user,
        });
        await this.tokenB.transfer(this.proxy.address, ether('100'), {
          from: user,
        });
        await this.tokenC.transfer(this.proxy.address, ether('100'), {
          from: user,
        });

        // Add tokens to cache for return user after handler execution
        await this.proxy.updateTokenMock(this.tokenA.address);
        await this.proxy.updateTokenMock(this.tokenB.address);
        await this.proxy.updateTokenMock(this.tokenC.address);
      });

      it('normal', async function() {
        // Get BPool Information
        const poolTokenABalance = await this.iBPool.getBalance.call(
          tokenAAddress
        );
        const poolTokenBBalance = await this.iBPool.getBalance.call(
          tokenBAddress
        );
        const poolTokenCBalance = await this.iBPool.getBalance.call(
          tokenCAddress
        );
        const poolTotalSupply = await this.iBPool.totalSupply.call();

        // Prepare handler data
        const to = this.hBalancer.address;
        const tokens = [tokenAAddress, tokenBAddress, tokenCAddress];
        const ratio = new BN('1000'); // ratio is 0.1%
        const poolAmountOut = poolTotalSupply.divRound(ratio);
        const maxTokenAAmount = poolTokenABalance.divRound(ratio);
        const maxTokenBAmount = poolTokenBBalance.divRound(ratio);
        const maxTokenCAmount = poolTokenCBalance.divRound(ratio);
        const maxAmountsIn = [
          maxTokenAAmount,
          maxTokenBAmount,
          maxTokenCAmount,
        ];

        const data = abi.simpleEncode(
          'joinPool(address[],address,uint256,uint256[])',
          tokens,
          balancerPoolAddress,
          poolAmountOut,
          maxAmountsIn
        );

        // Execute handler
        const receipt = await this.proxy.execMock(to, data, {
          from: user,
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
    });
  });
});
