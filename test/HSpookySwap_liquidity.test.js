const chainId = network.config.chainId;
if (chainId == 250) {
  // This test supports to run on these chains.
} else {
  return;
}

const {
  balance,
  BN,
  constants,
  ether,
  time,
} = require('@openzeppelin/test-helpers');
const { MAX_UINT256 } = constants;
const { tracker } = balance;
const { latest } = time;
const abi = require('ethereumjs-abi');
const utils = web3.utils;
const { expect } = require('chai');
const {
  WETH_TOKEN,
  DAI_TOKEN,
  SPOOKY_WFTM_WETH,
  SPOOKY_DAI_WETH,
  SPOOKY_ROUTER,
  BEETHOVENX_VAULT,
} = require('./utils/constants');
const {
  evmRevert,
  evmSnapshot,
  profileGas,
  getHandlerReturn,
  impersonateAndInjectEther,
} = require('./utils/utils');

const HSpookySwap = artifacts.require('HSpookySwap');
const Registry = artifacts.require('Registry');
const FeeRuleRegistry = artifacts.require('FeeRuleRegistry');
const Proxy = artifacts.require('ProxyMock');
const IToken = artifacts.require('IERC20');
const UniswapV2Router02 = artifacts.require('IUniswapV2Router02');

contract('SpookySwap Liquidity', function ([_, user]) {
  let id;
  const tokenAAddress = WETH_TOKEN;
  const tokenBAddress = DAI_TOKEN;
  const lpToken0Address = SPOOKY_WFTM_WETH;
  const lpToken1Address = SPOOKY_DAI_WETH;
  const routerAddress = SPOOKY_ROUTER;

  let balanceUser;
  let lpTokenUserAmount;
  let tokenAProviderAddress;
  let tokenBProviderAddress;

  before(async function () {
    await impersonateAndInjectEther(BEETHOVENX_VAULT);
    tokenAProviderAddress = BEETHOVENX_VAULT;
    tokenBProviderAddress = BEETHOVENX_VAULT;

    this.registry = await Registry.new();
    this.feeRuleRegistry = await FeeRuleRegistry.new('0', _);
    this.proxy = await Proxy.new(
      this.registry.address,
      this.feeRuleRegistry.address
    );
    this.hSpookySwap = await HSpookySwap.new();
    await this.registry.register(
      this.hSpookySwap.address,
      utils.asciiToHex('SpookySwap')
    );
    this.tokenA = await IToken.at(tokenAAddress);
    this.tokenB = await IToken.at(tokenBAddress);
    this.lpTokenFtm = await IToken.at(lpToken0Address);
    this.lpTokenToken = await IToken.at(lpToken1Address);
    this.router = await UniswapV2Router02.at(routerAddress);
  });

  beforeEach(async function () {
    id = await evmSnapshot();
    balanceUser = await tracker(user);
    balanceProxy = await tracker(this.proxy.address);
    tokenAUserAmount = await this.tokenA.balanceOf(user);
    tokenBUserAmount = await this.tokenB.balanceOf(user);
    uniTokenEthUserAmount = await this.lpTokenFtm.balanceOf(user);
    this.lpTokenTokenUserAmount = await this.lpTokenToken.balanceOf(user);

    await this.tokenA.transfer(user, ether('1'), {
      from: tokenAProviderAddress,
    });
    await this.tokenB.transfer(user, ether('1000'), {
      from: tokenBProviderAddress,
    });
  });

  afterEach(async function () {
    await evmRevert(id);
  });

  describe('Add FTM', function () {
    beforeEach(async function () {
      lpTokenUserAmount = await this.lpTokenFtm.balanceOf(user);
    });

    it('normal', async function () {
      // Prepare handler data
      const tokenAmount = ether('0.1');
      const minTokenAmount = ether('0.0001');
      const minFtmAmount = ether('0.0001');
      const value = ether('10');
      const to = this.hSpookySwap.address;
      const data = abi.simpleEncode(
        'addLiquidityETH(uint256,address,uint256,uint256,uint256):(uint256,uint256,uint256)',
        value,
        tokenAAddress,
        tokenAmount,
        minTokenAmount,
        minFtmAmount
      );

      tokenAUserAmount = await this.tokenA.balanceOf(user);
      await this.tokenA.transfer(this.proxy.address, tokenAmount, {
        from: user,
      });

      await this.proxy.updateTokenMock(this.tokenA.address);

      // Execute handler
      await balanceUser.get();
      const receipt = await this.proxy.execMock(to, data, {
        from: user,
        value: value,
      });

      // Get handler return result
      const handlerReturn = getHandlerReturn(receipt, [
        'uint256',
        'uint256',
        'uint256',
      ]);

      const tokenAUserAmountEnd = await this.tokenA.balanceOf(user);
      const lpTokenUserAmountEnd = await this.lpTokenFtm.balanceOf(user);
      const userBalanceDelta = await balanceUser.delta();

      expect(utils.toBN(handlerReturn[0])).to.be.bignumber.eq(
        tokenAUserAmount.sub(tokenAUserAmountEnd)
      );

      expect(userBalanceDelta).to.be.bignumber.eq(
        ether('0').sub(utils.toBN(handlerReturn[1]))
      );

      expect(utils.toBN(handlerReturn[2])).to.be.bignumber.eq(
        lpTokenUserAmountEnd.sub(lpTokenUserAmount)
      );

      // Result Verification
      // Verify spent ftm
      expect(userBalanceDelta).to.be.bignumber.lte(
        ether('0').sub(minFtmAmount)
      );

      // Verify spent token
      expect(await this.tokenA.balanceOf(user)).to.be.bignumber.lte(
        tokenAUserAmount.sub(minTokenAmount)
      );

      // Verify proxy token should be zero
      expect(
        await this.tokenA.balanceOf(this.proxy.address)
      ).to.be.bignumber.eq(ether('0'));
      expect(await balanceProxy.get()).to.be.bignumber.eq(ether('0'));

      // TODO: Find out the exact number of uniToken for testing
      // Verify spent ftm
      expect(await this.lpTokenFtm.balanceOf(user)).to.be.bignumber.gt(
        uniTokenEthUserAmount
      );

      // Gas profile
      profileGas(receipt);
    });

    it('max amount', async function () {
      // Prepare handler data
      const tokenAmount = ether('0.1');
      const minTokenAmount = ether('0.0001');
      const minFtmAmount = ether('0.0001');
      const value = ether('10');
      const to = this.hSpookySwap.address;
      const data = abi.simpleEncode(
        'addLiquidityETH(uint256,address,uint256,uint256,uint256):(uint256,uint256,uint256)',
        MAX_UINT256,
        tokenAAddress,
        MAX_UINT256,
        minTokenAmount,
        minFtmAmount
      );

      tokenAUserAmount = await this.tokenA.balanceOf(user);
      await this.tokenA.transfer(this.proxy.address, tokenAmount, {
        from: user,
      });
      await this.proxy.updateTokenMock(this.tokenA.address);

      // Execute handler
      await balanceUser.get();
      const receipt = await this.proxy.execMock(to, data, {
        from: user,
        value: value,
      });

      // Get handler return result
      const handlerReturn = getHandlerReturn(receipt, [
        'uint256',
        'uint256',
        'uint256',
      ]);

      const tokenAUserAmountEnd = await this.tokenA.balanceOf(user);
      const lpTokenUserAmountEnd = await this.lpTokenFtm.balanceOf(user);
      const userBalanceDelta = await balanceUser.delta();

      expect(utils.toBN(handlerReturn[0])).to.be.bignumber.eq(
        tokenAUserAmount.sub(tokenAUserAmountEnd)
      );

      expect(userBalanceDelta).to.be.bignumber.eq(
        ether('0').sub(utils.toBN(handlerReturn[1]))
      );

      expect(utils.toBN(handlerReturn[2])).to.be.bignumber.eq(
        lpTokenUserAmountEnd.sub(lpTokenUserAmount)
      );

      // Result Verification
      // Verify spent ftm
      expect(userBalanceDelta).to.be.bignumber.lte(
        ether('0').sub(minFtmAmount)
      );

      // Verify spent token
      expect(await this.tokenA.balanceOf(user)).to.be.bignumber.lte(
        tokenAUserAmount.sub(minTokenAmount)
      );

      // Verify proxy token should be zero
      expect(
        await this.tokenA.balanceOf(this.proxy.address)
      ).to.be.bignumber.eq(ether('0'));
      expect(await balanceProxy.get()).to.be.bignumber.eq(ether('0'));

      // TODO: Find out the exact number of uniToken for testing
      // Verify spent ftm
      expect(await this.lpTokenFtm.balanceOf(user)).to.be.bignumber.gt(
        uniTokenEthUserAmount
      );

      // Gas profile
      profileGas(receipt);
    });
  });

  describe('Add Token', function () {
    beforeEach(async function () {
      lpTokenUserAmount = await this.lpTokenToken.balanceOf(user);
    });

    it('normal', async function () {
      // Prepare handler data
      const tokenAAmount = ether('0.01');
      const tokenBAmount = ether('1000');
      const minTokenAAmount = ether('0.000001');
      const minTokenBAmount = ether('0.000001');
      const to = this.hSpookySwap.address;
      const data = abi.simpleEncode(
        'addLiquidity(address,address,uint256,uint256,uint256,uint256):(uint256,uint256,uint256)',
        tokenAAddress,
        tokenBAddress,
        tokenAAmount,
        tokenBAmount,
        minTokenAAmount,
        minTokenBAmount
      );

      tokenAUserAmount = await this.tokenA.balanceOf(user);
      tokenBUserAmount = await this.tokenB.balanceOf(user);
      // Send tokens to proxy
      await this.tokenA.transfer(this.proxy.address, tokenAAmount, {
        from: user,
      });
      await this.tokenB.transfer(this.proxy.address, tokenBAmount, {
        from: user,
      });

      // Add tokens to cache for return user after handler execution
      await this.proxy.updateTokenMock(this.tokenA.address);
      await this.proxy.updateTokenMock(this.tokenB.address);

      // Execute handler
      const receipt = await this.proxy.execMock(to, data, {
        from: user,
      });

      // Get handler return result
      const handlerReturn = getHandlerReturn(receipt, [
        'uint256',
        'uint256',
        'uint256',
      ]);

      const tokenAUserAmountEnd = await this.tokenA.balanceOf(user);
      const tokenBUserAmountEnd = await this.tokenB.balanceOf(user);
      const lpTokenUserAmountEnd = await this.lpTokenToken.balanceOf(user);

      expect(utils.toBN(handlerReturn[0])).to.be.bignumber.eq(
        tokenAUserAmount.sub(tokenAUserAmountEnd)
      );
      expect(utils.toBN(handlerReturn[1])).to.be.bignumber.eq(
        tokenBUserAmount.sub(tokenBUserAmountEnd)
      );
      expect(utils.toBN(handlerReturn[2])).to.be.bignumber.eq(
        lpTokenUserAmountEnd.sub(lpTokenUserAmount)
      );

      // Verify user tokens
      expect(await this.tokenA.balanceOf(user)).to.be.bignumber.lte(
        tokenAUserAmount.sub(minTokenAAmount)
      );
      expect(await this.tokenB.balanceOf(user)).to.be.bignumber.lte(
        tokenBUserAmount.sub(minTokenBAmount)
      );

      // Verify proxy token should be zero
      expect(
        await this.tokenA.balanceOf(this.proxy.address)
      ).to.be.bignumber.eq(ether('0'));
      expect(
        await this.tokenB.balanceOf(this.proxy.address)
      ).to.be.bignumber.eq(ether('0'));
      expect(await balanceProxy.get()).to.be.bignumber.eq(ether('0'));

      // TODO: Find out the exact number of uniToken for testing
      // Verify spent ether
      expect(await this.lpTokenToken.balanceOf(user)).to.be.bignumber.gt(
        this.lpTokenTokenUserAmount
      );

      // Gas profile
      profileGas(receipt);
    });

    it('max amount', async function () {
      // Prepare handler data
      const tokenAAmount = ether('0.01');
      const tokenBAmount = ether('1000');
      const minTokenAAmount = ether('0.000001');
      const minTokenBAmount = ether('0.000001');
      const to = this.hSpookySwap.address;
      const data = abi.simpleEncode(
        'addLiquidity(address,address,uint256,uint256,uint256,uint256):(uint256,uint256,uint256)',
        tokenAAddress,
        tokenBAddress,
        MAX_UINT256,
        MAX_UINT256,
        minTokenAAmount,
        minTokenBAmount
      );

      tokenAUserAmount = await this.tokenA.balanceOf(user);
      tokenBUserAmount = await this.tokenB.balanceOf(user);
      // Send tokens to proxy
      await this.tokenA.transfer(this.proxy.address, tokenAAmount, {
        from: user,
      });
      await this.tokenB.transfer(this.proxy.address, tokenBAmount, {
        from: user,
      });
      // Add tokens to cache for return user after handler execution
      await this.proxy.updateTokenMock(this.tokenA.address);
      await this.proxy.updateTokenMock(this.tokenB.address);

      // Execute handler
      const receipt = await this.proxy.execMock(to, data, {
        from: user,
      });

      // Get handler return result
      const handlerReturn = getHandlerReturn(receipt, [
        'uint256',
        'uint256',
        'uint256',
      ]);

      const tokenAUserAmountEnd = await this.tokenA.balanceOf(user);
      const tokenBUserAmountEnd = await this.tokenB.balanceOf(user);
      const lpTokenUserAmountEnd = await this.lpTokenToken.balanceOf(user);

      expect(utils.toBN(handlerReturn[0])).to.be.bignumber.eq(
        tokenAUserAmount.sub(tokenAUserAmountEnd)
      );
      expect(utils.toBN(handlerReturn[1])).to.be.bignumber.eq(
        tokenBUserAmount.sub(tokenBUserAmountEnd)
      );
      expect(utils.toBN(handlerReturn[2])).to.be.bignumber.eq(
        lpTokenUserAmountEnd.sub(lpTokenUserAmount)
      );

      // Verify user tokens
      expect(await this.tokenA.balanceOf(user)).to.be.bignumber.lte(
        tokenAUserAmount.sub(minTokenAAmount)
      );
      expect(await this.tokenB.balanceOf(user)).to.be.bignumber.lte(
        tokenBUserAmount.sub(minTokenBAmount)
      );

      // Verify proxy token should be zero
      expect(
        await this.tokenA.balanceOf(this.proxy.address)
      ).to.be.bignumber.eq(ether('0'));
      expect(
        await this.tokenB.balanceOf(this.proxy.address)
      ).to.be.bignumber.eq(ether('0'));
      expect(await balanceProxy.get()).to.be.bignumber.eq(ether('0'));

      // TODO: Find out the exact number of uniToken for testing
      // Verify spent ether
      expect(await this.lpTokenToken.balanceOf(user)).to.be.bignumber.gt(
        this.lpTokenTokenUserAmount
      );

      // Gas profile
      profileGas(receipt);
    });
  });

  describe('Remove FTM', function () {
    let deadline;

    beforeEach(async function () {
      // Add liquidity for getting uniToken before remove liquidity
      await this.tokenA.approve(this.router.address, ether('0.01'), {
        from: user,
      });
      deadline = (await latest()).add(new BN('100'));
      await this.router.addLiquidityETH(
        this.tokenA.address,
        ether('0.01'),
        new BN('1'),
        new BN('1'),
        user,
        deadline,
        {
          from: user,
          value: ether('10'),
        }
      );

      // Get user tokenA/uniToken balance
      tokenAUserAmount = await this.tokenA.balanceOf(user);
      lpTokenUserAmount = await this.lpTokenFtm.balanceOf(user);
    });

    it('normal', async function () {
      // Get simulation result
      await this.lpTokenFtm.approve(this.router.address, lpTokenUserAmount, {
        from: user,
      });
      const result = await this.router.removeLiquidityETH.call(
        this.tokenA.address,
        lpTokenUserAmount,
        new BN('1'),
        new BN('1'),
        user,
        deadline,
        { from: user }
      );

      // Send uniToken to proxy and prepare handler data
      await this.lpTokenFtm.transfer(this.proxy.address, lpTokenUserAmount, {
        from: user,
      });
      await this.proxy.updateTokenMock(this.lpTokenFtm.address);

      const value = lpTokenUserAmount;
      const to = this.hSpookySwap.address;
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

      // Get handler return result
      const handlerReturn = getHandlerReturn(receipt, ['uint256', 'uint256']);
      const tokenAUserAmountEnd = await this.tokenA.balanceOf(user);
      const userBalanceDelta = await balanceUser.delta();
      expect(utils.toBN(handlerReturn[0])).to.be.bignumber.eq(
        tokenAUserAmountEnd.sub(tokenAUserAmount)
      );
      expect(userBalanceDelta).to.be.bignumber.eq(utils.toBN(handlerReturn[1]));

      // Verify User Token
      expect(await this.tokenA.balanceOf(user)).to.be.bignumber.eq(
        tokenAUserAmount.add(result[0])
      );
      expect(await this.lpTokenFtm.balanceOf(user)).to.be.bignumber.eq(
        ether('0')
      );

      // Verify proxy token should be zero
      expect(
        await this.lpTokenFtm.balanceOf(this.proxy.address)
      ).to.be.bignumber.eq(ether('0'));
      expect(
        await this.tokenA.balanceOf(this.proxy.address)
      ).to.be.bignumber.eq(ether('0'));
      expect(await balanceProxy.get()).to.be.bignumber.eq(ether('0'));

      // Verify spent ftm
      expect(userBalanceDelta).to.be.bignumber.eq(result[1]);

      // Gas profile
      profileGas(receipt);
    });

    it('max amount', async function () {
      // Get simulation result
      await this.lpTokenFtm.approve(this.router.address, lpTokenUserAmount, {
        from: user,
      });
      const result = await this.router.removeLiquidityETH.call(
        this.tokenA.address,
        lpTokenUserAmount,
        new BN('1'),
        new BN('1'),
        user,
        deadline,
        { from: user }
      );

      // Send uniToken to proxy and prepare handler data
      await this.lpTokenFtm.transfer(this.proxy.address, lpTokenUserAmount, {
        from: user,
      });
      await this.proxy.updateTokenMock(this.lpTokenFtm.address);

      const value = lpTokenUserAmount;
      const to = this.hSpookySwap.address;
      const data = abi.simpleEncode(
        'removeLiquidityETH(address,uint256,uint256,uint256):(uint256,uint256)',
        tokenAAddress,
        MAX_UINT256,
        new BN('1'),
        new BN('1')
      );

      // Execute handler
      await balanceUser.get();
      const receipt = await this.proxy.execMock(to, data, { from: user });

      // Get handler return result
      const handlerReturn = getHandlerReturn(receipt, ['uint256', 'uint256']);
      const tokenAUserAmountEnd = await this.tokenA.balanceOf(user);
      const userBalanceDelta = await balanceUser.delta();
      expect(utils.toBN(handlerReturn[0])).to.be.bignumber.eq(
        tokenAUserAmountEnd.sub(tokenAUserAmount)
      );
      expect(userBalanceDelta).to.be.bignumber.eq(utils.toBN(handlerReturn[1]));

      // Verify User Token
      expect(await this.tokenA.balanceOf(user)).to.be.bignumber.eq(
        tokenAUserAmount.add(result[0])
      );
      expect(await this.lpTokenFtm.balanceOf(user)).to.be.bignumber.eq(
        ether('0')
      );

      // Verify proxy token should be zero
      expect(
        await this.lpTokenFtm.balanceOf(this.proxy.address)
      ).to.be.bignumber.eq(ether('0'));
      expect(
        await this.tokenA.balanceOf(this.proxy.address)
      ).to.be.bignumber.eq(ether('0'));
      expect(await balanceProxy.get()).to.be.bignumber.eq(ether('0'));

      // Verify spent ftm
      expect(userBalanceDelta).to.be.bignumber.eq(result[1]);

      // Gas profile
      profileGas(receipt);
    });
  });

  describe('Remove Token', function () {
    let deadline;

    beforeEach(async function () {
      await this.tokenA.transfer(user, ether('0.01'), {
        from: tokenAProviderAddress,
      });

      await this.tokenB.transfer(user, ether('1000'), {
        from: tokenBProviderAddress,
      });

      await this.tokenA.approve(this.router.address, ether('0.01'), {
        from: user,
      });
      await this.tokenB.approve(this.router.address, ether('1000'), {
        from: user,
      });
      deadline = (await latest()).add(new BN('100'));

      await this.router.addLiquidity(
        this.tokenA.address,
        this.tokenB.address,
        ether('0.01'),
        ether('1000'),
        new BN('1'),
        new BN('1'),
        user,
        deadline,
        {
          from: user,
        }
      );
      tokenAUserAmount = await this.tokenA.balanceOf(user);
      tokenBUserAmount = await this.tokenB.balanceOf(user);
      lpTokenUserAmount = await this.lpTokenToken.balanceOf(user);
    });

    it('normal', async function () {
      // Get simulation result
      await this.lpTokenToken.approve(this.router.address, lpTokenUserAmount, {
        from: user,
      });
      const result = await this.router.removeLiquidity.call(
        this.tokenA.address,
        this.tokenB.address,
        lpTokenUserAmount,
        new BN('1'),
        new BN('1'),
        user,
        deadline,
        { from: user }
      );
      // Send uniToken to proxy and prepare handler data
      await this.lpTokenToken.transfer(this.proxy.address, lpTokenUserAmount, {
        from: user,
      });
      await this.proxy.updateTokenMock(this.lpTokenToken.address);

      const value = lpTokenUserAmount;
      const to = this.hSpookySwap.address;
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

      // Get handler return result
      const handlerReturn = getHandlerReturn(receipt, ['uint256', 'uint256']);
      const tokenAUserAmountEnd = await this.tokenA.balanceOf(user);
      const tokenBUserAmountEnd = await this.tokenB.balanceOf(user);

      expect(utils.toBN(handlerReturn[0])).to.be.bignumber.eq(
        tokenAUserAmountEnd.sub(tokenAUserAmount)
      );
      expect(utils.toBN(handlerReturn[1])).to.be.bignumber.eq(
        tokenBUserAmountEnd.sub(tokenBUserAmount)
      );

      // Verify user token
      expect(await this.tokenA.balanceOf(user)).to.be.bignumber.eq(
        tokenAUserAmount.add(result[0])
      );
      expect(await this.tokenB.balanceOf(user)).to.be.bignumber.eq(
        tokenBUserAmount.add(result[1])
      );
      expect(await this.lpTokenToken.balanceOf(user)).to.be.bignumber.eq(
        ether('0')
      );

      // Verify proxy token should be zero
      expect(
        await this.lpTokenToken.balanceOf(this.proxy.address)
      ).to.be.bignumber.eq(ether('0'));
      expect(
        await this.tokenA.balanceOf(this.proxy.address)
      ).to.be.bignumber.eq(ether('0'));
      expect(
        await this.tokenB.balanceOf(this.proxy.address)
      ).to.be.bignumber.eq(ether('0'));
      expect(await balanceProxy.get()).to.be.bignumber.eq(ether('0'));

      // Verify spent ftm
      expect(await balanceUser.delta()).to.be.bignumber.eq(ether('0'));

      // Gas profile
      profileGas(receipt);
    });

    it('max amount', async function () {
      // Get simulation result
      await this.lpTokenToken.approve(this.router.address, lpTokenUserAmount, {
        from: user,
      });
      const result = await this.router.removeLiquidity.call(
        this.tokenA.address,
        this.tokenB.address,
        lpTokenUserAmount,
        new BN('1'),
        new BN('1'),
        user,
        deadline,
        { from: user }
      );
      // Send uniToken to proxy and prepare handler data
      await this.lpTokenToken.transfer(this.proxy.address, lpTokenUserAmount, {
        from: user,
      });
      await this.proxy.updateTokenMock(this.lpTokenToken.address);

      const to = this.hSpookySwap.address;
      const data = abi.simpleEncode(
        'removeLiquidity(address,address,uint256,uint256,uint256):(uint256,uint256)',
        tokenAAddress,
        tokenBAddress,
        MAX_UINT256,
        new BN('1'),
        new BN('1')
      );

      // Execute handler
      await balanceUser.get();
      const receipt = await this.proxy.execMock(to, data, { from: user });

      // Get handler return result
      const handlerReturn = getHandlerReturn(receipt, ['uint256', 'uint256']);
      const tokenAUserAmountEnd = await this.tokenA.balanceOf(user);
      const tokenBUserAmountEnd = await this.tokenB.balanceOf(user);

      expect(utils.toBN(handlerReturn[0])).to.be.bignumber.eq(
        tokenAUserAmountEnd.sub(tokenAUserAmount)
      );
      expect(utils.toBN(handlerReturn[1])).to.be.bignumber.eq(
        tokenBUserAmountEnd.sub(tokenBUserAmount)
      );

      // Verify user token
      expect(await this.tokenA.balanceOf(user)).to.be.bignumber.eq(
        tokenAUserAmount.add(result[0])
      );
      expect(await this.tokenB.balanceOf(user)).to.be.bignumber.eq(
        tokenBUserAmount.add(result[1])
      );
      expect(await this.lpTokenToken.balanceOf(user)).to.be.bignumber.eq(
        ether('0')
      );

      // Verify proxy token should be zero
      expect(
        await this.lpTokenToken.balanceOf(this.proxy.address)
      ).to.be.bignumber.eq(ether('0'));
      expect(
        await this.tokenA.balanceOf(this.proxy.address)
      ).to.be.bignumber.eq(ether('0'));
      expect(
        await this.tokenB.balanceOf(this.proxy.address)
      ).to.be.bignumber.eq(ether('0'));
      expect(await balanceProxy.get()).to.be.bignumber.eq(ether('0'));

      // Verify spent ftm
      expect(await balanceUser.delta()).to.be.bignumber.eq(ether('0'));

      // Gas profile
      profileGas(receipt);
    });
  });
});
