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
} = require('./utils/constants');
const { resetAccount, profileGas } = require('./utils/utils');

const HUniswapV2 = artifacts.require('HUniswapV2');
const Registry = artifacts.require('Registry');
const Proxy = artifacts.require('ProxyMock');
const IToken = artifacts.require('IERC20');

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
});
