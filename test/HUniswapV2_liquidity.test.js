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
  UNISWAPV2_ROUTER02,
} = require('./utils/constants');
const { evmRevert, evmSnapshot, profileGas } = require('./utils/utils');

const HUniswapV2 = artifacts.require('HUniswapV2');
const Registry = artifacts.require('Registry');
const Proxy = artifacts.require('ProxyMock');
const IToken = artifacts.require('IERC20');
const UniswapV2Router02 = artifacts.require('IUniswapV2Router02');

contract('UniswapV2 Liquidity', function([_, user]) {
  let id;
  const tokenAAddress = DAI_TOKEN;
  const tokenBAddress = BAT_TOKEN;
  const tokenAProviderAddress = DAI_PROVIDER;
  const tokenBProviderAddress = BAT_PROVIDER;
  const uniswapV2ETHDAIAddress = UNISWAPV2_ETH_DAI;
  const uniswapV2BATDAIAddress = UNISWAPV2_BAT_DAI;
  const uniswapV2RouterAddress = UNISWAPV2_ROUTER02;

  let balanceUser;
  let tokenUser;
  let uniTokenUserAmount;

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
    id = await evmSnapshot();
    balanceUser = await tracker(user);
    balanceProxy = await tracker(this.proxy.address);
    tokenAUserAmount = await this.tokenA.balanceOf.call(user);
    tokenBUserAmount = await this.tokenB.balanceOf.call(user);
    uniTokenETHUserAmount = await this.uniTokenETH.balanceOf.call(user);
    uniTokenTokenUserAmount = await this.uniTokenToken.balanceOf.call(user);
  });

  afterEach(async function() {
    await evmRevert(id);
  });

  describe('Add ETH', function() {
    beforeEach(async function() {
      // Send Token to proxy
      await this.tokenA.transfer(this.proxy.address, ether('100'), {
        from: user,
      });
      // Add Token to cache for return user after handler execution
      await this.proxy.updateTokenMock(this.tokenA.address);
    });

    it('normal', async function() {
      // Prepare handler data
      const tokenAmount = ether('0.002');
      const minTokenAmount = ether('0.000001');
      const minEthAmount = ether('0.000001');
      const value = ether('1');
      const to = this.huniswapv2.address;
      const data = abi.simpleEncode(
        'addLiquidityETH(uint256,address,uint256,uint256,uint256):(uint256,uint256,uint256)',
        value,
        tokenAAddress,
        tokenAmount,
        minTokenAmount,
        minEthAmount
      );

      // Execute handler
      await balanceUser.get();
      const receipt = await this.proxy.execMock(to, data, {
        from: user,
        value: value,
      });

      // Result Verification
      // Verify spent ether
      expect(await balanceUser.delta()).to.be.bignumber.lte(
        ether('0')
          .sub(minEthAmount)
          .sub(new BN(receipt.receipt.gasUsed))
      );

      // Verify spent token
      expect(await this.tokenA.balanceOf.call(user)).to.be.bignumber.lte(
        tokenAUserAmount.sub(minTokenAmount)
      );

      // Verify proxy token should be zero
      expect(
        await this.tokenA.balanceOf.call(this.proxy.address)
      ).to.be.bignumber.eq(ether('0'));
      expect(await balanceProxy.get()).to.be.bignumber.eq(ether('0'));

      // TODO: Find out the exact number of uniToken for testing
      // Verify spent ether
      expect(await this.uniTokenETH.balanceOf.call(user)).to.be.bignumber.gt(
        uniTokenETHUserAmount
      );

      // Gas profile
      profileGas(receipt);
    });
  });

  describe('Add Token', function() {
    beforeEach(async function() {
      // Send tokens to proxy
      await this.tokenA.transfer(this.proxy.address, ether('100'), {
        from: user,
      });
      await this.tokenB.transfer(this.proxy.address, ether('100'), {
        from: user,
      });

      // Add tokens to cache for return user after handler execution
      await this.proxy.updateTokenMock(this.tokenA.address);
      await this.proxy.updateTokenMock(this.tokenB.address);
    });

    it('normal', async function() {
      // Prepare handler data
      const tokenAAmount = ether('0.002');
      const tokenBAmount = ether('0.002');
      const minTokenAAmount = ether('0.000001');
      const minTokenBAmount = ether('0.000001');
      const to = this.huniswapv2.address;
      const data = abi.simpleEncode(
        'addLiquidity(address,address,uint256,uint256,uint256,uint256):(uint256,uint256,uint256)',
        tokenAAddress,
        tokenBAddress,
        tokenAAmount,
        tokenBAmount,
        minTokenAAmount,
        minTokenBAmount
      );

      // Execute handler
      const receipt = await this.proxy.execMock(to, data, {
        from: user,
      });

      // Verify user tokens
      expect(await this.tokenA.balanceOf.call(user)).to.be.bignumber.lte(
        tokenAUserAmount.sub(minTokenAAmount)
      );
      expect(await this.tokenB.balanceOf.call(user)).to.be.bignumber.lte(
        tokenBUserAmount.sub(minTokenBAmount)
      );

      // Verify proxy token should be zero
      expect(
        await this.tokenA.balanceOf.call(this.proxy.address)
      ).to.be.bignumber.eq(ether('0'));
      expect(
        await this.tokenB.balanceOf.call(this.proxy.address)
      ).to.be.bignumber.eq(ether('0'));
      expect(await balanceProxy.get()).to.be.bignumber.eq(ether('0'));

      // TODO: Find out the exact number of uniToken for testing
      // Verify spent ether
      expect(await this.uniTokenToken.balanceOf.call(user)).to.be.bignumber.gt(
        uniTokenTokenUserAmount
      );

      // Gas profile
      profileGas(receipt);
    });
  });

  describe('Remove ETH', function() {
    let deadline;

    beforeEach(async function() {
      // Add liquidity for getting uniToken before remove liquidity
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

      // Get user tokenA/uniToken balance
      tokenAUserAmount = await this.tokenA.balanceOf.call(user);
      uniTokenUserAmount = await this.uniTokenETH.balanceOf.call(user);
    });

    it('normal', async function() {
      // Get simulation result
      await this.uniTokenETH.approve(this.router.address, uniTokenUserAmount, {
        from: user,
      });
      const result = await this.router.removeLiquidityETH.call(
        this.tokenA.address,
        uniTokenUserAmount,
        new BN('1'),
        new BN('1'),
        user,
        deadline,
        { from: user }
      );

      // Send uniToken to proxy and prepare handler data
      await this.uniTokenETH.transfer(this.proxy.address, uniTokenUserAmount, {
        from: user,
      });
      await this.proxy.updateTokenMock(this.uniTokenETH.address);

      const value = uniTokenUserAmount;
      const to = this.huniswapv2.address;
      const data = abi.simpleEncode(
        'removeLiquidityETH(address,uint256,uint256,uint256):(uint256,uint256)',
        tokenAAddress,
        value,
        new BN('1'),
        new BN('1')
      );

      // Execute handler
      await balanceUser.get();
      const receipt = await this.proxy.execMock(to, data, { from: user });

      // Verify User Token
      expect(await this.tokenA.balanceOf.call(user)).to.be.bignumber.eq(
        tokenAUserAmount.add(result[0])
      );
      expect(await this.uniTokenETH.balanceOf.call(user)).to.be.bignumber.eq(
        ether('0')
      );

      // Verify proxy token should be zero
      expect(
        await this.uniTokenETH.balanceOf.call(this.proxy.address)
      ).to.be.bignumber.eq(ether('0'));
      expect(
        await this.tokenA.balanceOf.call(this.proxy.address)
      ).to.be.bignumber.eq(ether('0'));
      expect(await balanceProxy.get()).to.be.bignumber.eq(ether('0'));

      // Verify spent ETH
      expect(await balanceUser.delta()).to.be.bignumber.eq(
        result[1].sub(new BN(receipt.receipt.gasUsed))
      );

      // Gas profile
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
      tokenAUserAmount = await this.tokenA.balanceOf.call(user);
      tokenBUserAmount = await this.tokenB.balanceOf.call(user);
      uniTokenUserAmount = await this.uniTokenToken.balanceOf.call(user);
    });

    it('normal', async function() {
      // Get simulation result
      await this.uniTokenToken.approve(
        this.router.address,
        uniTokenUserAmount,
        {
          from: user,
        }
      );
      const result = await this.router.removeLiquidity.call(
        this.tokenA.address,
        this.tokenB.address,
        uniTokenUserAmount,
        new BN('1'),
        new BN('1'),
        user,
        deadline,
        { from: user }
      );
      // Send uniToken to proxy and prepare handler data
      await this.uniTokenToken.transfer(
        this.proxy.address,
        uniTokenUserAmount,
        {
          from: user,
        }
      );
      await this.proxy.updateTokenMock(this.uniTokenToken.address);

      const value = uniTokenUserAmount;
      const to = this.huniswapv2.address;
      const data = abi.simpleEncode(
        'removeLiquidity(address,address,uint256,uint256,uint256):(uint256,uint256)',
        tokenAAddress,
        tokenBAddress,
        value,
        new BN('1'),
        new BN('1')
      );

      // Execute handler
      await balanceUser.get();
      const receipt = await this.proxy.execMock(to, data, { from: user });

      // Verify user token
      expect(await this.tokenA.balanceOf.call(user)).to.be.bignumber.eq(
        tokenAUserAmount.add(result[0])
      );
      expect(await this.tokenB.balanceOf.call(user)).to.be.bignumber.eq(
        tokenBUserAmount.add(result[1])
      );
      expect(await this.uniTokenToken.balanceOf.call(user)).to.be.bignumber.eq(
        ether('0')
      );

      // Verify proxy token should be zero
      expect(
        await this.uniTokenToken.balanceOf.call(this.proxy.address)
      ).to.be.bignumber.eq(ether('0'));
      expect(
        await this.tokenA.balanceOf.call(this.proxy.address)
      ).to.be.bignumber.eq(ether('0'));
      expect(
        await this.tokenB.balanceOf.call(this.proxy.address)
      ).to.be.bignumber.eq(ether('0'));
      expect(await balanceProxy.get()).to.be.bignumber.eq(ether('0'));

      // Verify spent ETH
      expect(await balanceUser.delta()).to.be.bignumber.eq(
        ether('0').sub(new BN(receipt.receipt.gasUsed))
      );

      // Gas profile
      profileGas(receipt);
    });
  });
});
