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
  DAI_TOKEN,
  BAT_TOKEN,
  DAI_PROVIDER,
  BAT_PROVIDER,
  ETH_PROVIDER,
  UNISWAPV2_ETH_DAI,
  UNISWAPV2_BAT_DAI,
  UNISWAPV2_RouterV2,
} = require('./utils/constants');
const { resetAccount, profileGas } = require('./utils/utils');

const HUniswapV2 = artifacts.require('HUniswapV2');
const Registry = artifacts.require('Registry');
const Proxy = artifacts.require('ProxyMock');
const IToken = artifacts.require('IERC20');
const UniswapV2Router02 = artifacts.require('IUniswapV2Router02');

contract('UniswapV2 Liquidity', function([_, deployer, user]) {
  // const tokenAddress = DAI_TOKEN;
  // const providerAddress = DAI_PROVIDER;
  // const uniswapV2ETHDAIAddress = UNISWAPV2_ETH_DAI;

  const tokenAAddress = DAI_TOKEN;
  const tokenBAddress = BAT_TOKEN;
  const tokenAProviderAddress = DAI_PROVIDER;
  const tokenBProviderAddress = BAT_PROVIDER;
  const uniswapV2ETHDAIAddress = UNISWAPV2_ETH_DAI;
  const uniswapV2BATDAIAddress = UNISWAPV2_BAT_DAI;
  const uniswapV2RouterAddress = UNISWAPV2_RouterV2;

  let balanceUser;
  let tokenUser;
  let uniTokenUser;

  before(async function() {
    this.registry = await Registry.new();
    this.proxy = await Proxy.new(this.registry.address);
    this.huniswapv2 = await HUniswapV2.new();
    await this.registry.register(
      this.huniswapv2.address,
      utils.asciiToHex('UniswapV2')
    );
    this.tokenA = await IToken.at(tokenAAddress);
    this.tokenB = await IToken.at(tokenBAddress);
    this.uniTokenETH = await IToken.at(uniswapV2ETHDAIAddress);
    this.uniTokenToken = await IToken.at(uniswapV2BATDAIAddress);
    this.router = await UniswapV2Router02.at(uniswapV2RouterAddress);

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
    balanceUser = await tracker(user);
    tokenAUser = await this.tokenA.balanceOf.call(user);
    tokenBUser = await this.tokenB.balanceOf.call(user);
    uniTokenETHUser = await this.uniTokenETH.balanceOf.call(user);
    uniTokenTokenUser = await this.uniTokenToken.balanceOf.call(user);
  });

  describe('Add ETH', function() {
    beforeEach(async function() {
      await this.tokenA.transfer(this.proxy.address, ether('100'), {
        from: user,
      });
      await this.proxy.updateTokenMock(this.tokenA.address);
    });

    it('normal', async function() {
      const daiAmount = ether('0.002');
      const minDaiAmount = ether('0.000001');
      const minEthAmount = ether('0.000001');
      const value = ether('1');
      const to = this.huniswapv2.address;
      const data = abi.simpleEncode(
        'addLiquidityETH(uint256,address,uint256,uint256,uint256)',
        value,
        tokenAAddress,
        daiAmount,
        minDaiAmount,
        minEthAmount
      );

      const receipt = await this.proxy.execMock(to, data, {
        from: user,
        value: value,
      });

      // Check spent ether
      expect(await balanceUser.delta()).to.be.bignumber.lt(
        ether('0')
          .sub(minEthAmount)
          .sub(new BN(receipt.receipt.gasUsed))
      );

      // Check spent token
      expect(await this.tokenA.balanceOf.call(user)).to.be.bignumber.lte(
        tokenAUser.sub(minDaiAmount)
      );

      // TODO: Find out the exact number of uniToken for testing
      expect(await this.uniTokenETH.balanceOf.call(user)).to.be.bignumber.gt(
        uniTokenETHUser
      );
      profileGas(receipt);
    });
  });

  describe('Add Token', function() {
    beforeEach(async function() {
      await this.tokenA.transfer(this.proxy.address, ether('100'), {
        from: user,
      });
      await this.tokenB.transfer(this.proxy.address, ether('100'), {
        from: user,
      });
      await this.proxy.updateTokenMock(this.tokenA.address);
      await this.proxy.updateTokenMock(this.tokenB.address);
    });

    it('normal', async function() {
      const tokenAAmount = ether('0.002');
      const tokenBAmount = ether('0.002');
      const minTokenAAmount = ether('0.000001');
      const minTokenBAmount = ether('0.000001');
      const to = this.huniswapv2.address;
      const data = abi.simpleEncode(
        'addLiquidity(address,address,uint256,uint256,uint256,uint256)',
        tokenAAddress,
        tokenBAddress,
        tokenAAmount,
        tokenBAmount,
        minTokenAAmount,
        minTokenBAmount
      );

      const receipt = await this.proxy.execMock(to, data, {
        from: user,
      });

      // Check spent token
      expect(await this.tokenA.balanceOf.call(user)).to.be.bignumber.lte(
        tokenAUser.sub(minTokenAAmount)
      );

      expect(await this.tokenB.balanceOf.call(user)).to.be.bignumber.lte(
        tokenBUser.sub(minTokenBAmount)
      );

      // TODO: Find out the exact number of uniToken for testing
      expect(await this.uniTokenToken.balanceOf.call(user)).to.be.bignumber.gt(
        uniTokenTokenUser
      );
      profileGas(receipt);
    });
  });

  describe('Remove ETH', function() {
    let deadline;

    beforeEach(async function() {
      await this.tokenA.transfer(user, ether('100'), {
        from: tokenAProviderAddress,
      });

      await this.tokenA.approve(this.router.address, ether('1000'), {
        from: user,
      });
      deadline = (await latest()).add(new BN('100'));

      await this.router.addLiquidityETH(
        this.tokenA.address,
        ether('100'),
        new BN('1'),
        new BN('1'),
        user,
        deadline,
        {
          from: user,
          value: ether('0.1'),
        }
      );
      tokenAUser = await this.tokenA.balanceOf.call(user);
      uniTokenUser = await this.uniTokenETH.balanceOf.call(user);
    });

    it('normal', async function() {
      // Get simulation result
      await this.uniTokenETH.approve(this.router.address, uniTokenUser, {
        from: user,
      });
      const result = await this.router.removeLiquidityETH.call(
        this.tokenA.address,
        uniTokenUser,
        new BN('1'),
        new BN('1'),
        user,
        deadline,
        { from: user }
      );

      // Send uniToken to proxy and prepare handler data
      await this.uniTokenETH.transfer(this.proxy.address, uniTokenUser, {
        from: user,
      });
      await balanceUser.get();
      const value = uniTokenUser;
      const to = this.huniswapv2.address;
      const data = abi.simpleEncode(
        'removeLiquidityETH(address,uint256,uint256,uint256):(uint256,uint256)',
        tokenAAddress,
        value,
        new BN('1'),
        new BN('1')
      );

      // Add TokenA to cache for send back to user and execute handler
      await this.proxy.updateTokenMock(this.tokenA.address);
      const receipt = await this.proxy.execMock(to, data, { from: user });

      // Result Verification
      // Verify Token A
      expect(await this.tokenA.balanceOf.call(user)).to.be.bignumber.eq(
        tokenAUser.add(result['0'])
      );

      // Verify ETH
      expect(await balanceUser.delta()).to.be.bignumber.eq(
        result['1'].sub(new BN(receipt.receipt.gasUsed))
      );
      profileGas(receipt);
    });
  });

  describe('Remove Token', function() {
    let deadline;

    beforeEach(async function() {
      await this.tokenA.transfer(user, ether('100'), {
        from: tokenAProviderAddress,
      });

      await this.tokenB.transfer(user, ether('100'), {
        from: tokenBProviderAddress,
      });

      await this.tokenA.approve(this.router.address, ether('1000'), {
        from: user,
      });
      await this.tokenB.approve(this.router.address, ether('1000'), {
        from: user,
      });
      deadline = (await latest()).add(new BN('100'));

      await this.router.addLiquidity(
        this.tokenA.address,
        this.tokenB.address,
        ether('100'),
        ether('100'),
        new BN('1'),
        new BN('1'),
        user,
        deadline,
        {
          from: user,
        }
      );
      tokenAUser = await this.tokenA.balanceOf.call(user);
      tokenBUser = await this.tokenB.balanceOf.call(user);
      uniTokenUser = await this.uniTokenToken.balanceOf.call(user);
      console.log(uniTokenUser);
    });

    it('normal', async function() {
      // Get simulation result
      await this.uniTokenToken.approve(this.router.address, uniTokenUser, {
        from: user,
      });
      const result = await this.router.removeLiquidity.call(
        this.tokenA.address,
        this.tokenB.address,
        uniTokenUser,
        new BN('1'),
        new BN('1'),
        user,
        deadline,
        { from: user }
      );
      // Send uniToken to proxy and prepare handler data
      await this.uniTokenToken.transfer(this.proxy.address, uniTokenUser, {
        from: user,
      });
      await balanceUser.get(); // Get user eth balance now

      const value = uniTokenUser;
      const to = this.huniswapv2.address;
      const data = abi.simpleEncode(
        'removeLiquidity(address,address,uint256,uint256,uint256):(uint256,uint256)',
        tokenAAddress,
        tokenBAddress,
        value,
        new BN('1'),
        new BN('1')
      );

      // Add tokens to cache for send back to user and execute handler
      await this.proxy.updateTokenMock(this.tokenA.address);
      await this.proxy.updateTokenMock(this.tokenB.address);
      const receipt = await this.proxy.execMock(to, data, { from: user });

      // Result verification
      // Verify TokenA and Token B
      expect(await this.tokenA.balanceOf.call(user)).to.be.bignumber.eq(
        tokenAUser.add(result['0'])
      );
      expect(await this.tokenB.balanceOf.call(user)).to.be.bignumber.eq(
        tokenBUser.add(result['1'])
      );

      // Verify UniToken
      expect(await this.uniTokenToken.balanceOf.call(user)).to.be.bignumber.lt(
        uniTokenUser
      );
      // Verify ETH
      expect(await balanceUser.delta()).to.be.bignumber.eq(
        new BN(-1).mul(new BN(receipt.receipt.gasUsed))
      );
      profileGas(receipt);
    });
  });
});
