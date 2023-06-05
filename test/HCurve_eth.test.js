if (network.config.chainId == 1) {
  // This test supports to run on these chains.
} else {
  return;
}

const { balance, BN, ether, constants } = require('@openzeppelin/test-helpers');
const { web3 } = require('@openzeppelin/test-helpers/src/setup');
const { tracker } = balance;
const { MAX_UINT256 } = constants;
const { expect } = require('chai');
const abi = require('ethereumjs-abi');
const utils = web3.utils;
const {
  NATIVE_TOKEN_ADDRESS,
  DAI_TOKEN,
  USDT_TOKEN,
  SETH_TOKEN,
  WBTC_TOKEN,
  HBTC_TOKEN,
  CURVE_AAVECRV,
  CURVE_AAVE_SWAP,
  CURVE_Y_SWAP,
  CURVE_Y_DEPOSIT,
  CURVE_SETH_SWAP,
  CURVE_YCRV,
  CURVE_3POOLCRV,
  CURVE_3POOL_SWAP,
  CURVE_SETHCRV,
  CURVE_HBTCCRV,
  CURVE_YDAI_TOKEN,
  CURVE_YUSDT_TOKEN,
  CURVE_HBTC_SWAP,
  HBTC_PROVIDER,
} = require('./utils/constants');
const {
  evmRevert,
  evmSnapshot,
  mulPercent,
  profileGas,
  getHandlerReturn,
  expectEqWithinBps,
  tokenProviderUniV2,
  tokenProviderCurveGauge,
  impersonateAndInjectEther,
} = require('./utils/utils');

const FeeRuleRegistry = artifacts.require('FeeRuleRegistry');
const Proxy = artifacts.require('ProxyMock');
const Registry = artifacts.require('Registry');
const HCurve = artifacts.require('HCurve');
const ICurveHandler = artifacts.require('ICurveHandler');
const IToken = artifacts.require('IERC20');
const IYToken = artifacts.require('IYToken');

contract('Curve_eth', function ([_, user]) {
  const slippage = new BN('3');
  let id;
  before(async function () {
    this.registry = await Registry.new();
    this.hCurve = await HCurve.new();
    await this.registry.register(
      this.hCurve.address,
      utils.asciiToHex('HCurve')
    );
    this.feeRuleRegistry = await FeeRuleRegistry.new('0', _);
    this.proxy = await Proxy.new(
      this.registry.address,
      this.feeRuleRegistry.address
    );
    this.ySwap = await ICurveHandler.at(CURVE_Y_SWAP);
    this.yDeposit = await ICurveHandler.at(CURVE_Y_DEPOSIT);
    this.threeSwap = await ICurveHandler.at(CURVE_3POOL_SWAP);
    this.sethSwap = await ICurveHandler.at(CURVE_SETH_SWAP);
    this.hbtcSwap = await ICurveHandler.at(CURVE_HBTC_SWAP);
    this.aaveSwap = await ICurveHandler.at(CURVE_AAVE_SWAP);
  });

  beforeEach(async function () {
    id = await evmSnapshot();
  });

  afterEach(async function () {
    await evmRevert(id);
  });

  describe('Exchange underlying', function () {
    const token0Address = USDT_TOKEN;
    const token1Address = DAI_TOKEN;

    let token0User;
    let token1User;
    let providerAddress;

    before(async function () {
      providerAddress = await tokenProviderUniV2(token0Address);

      this.token0 = await IToken.at(token0Address);
      this.token1 = await IToken.at(token1Address);
    });

    beforeEach(async function () {
      token0User = await this.token0.balanceOf.call(user);
      token1User = await this.token1.balanceOf.call(user);
    });

    describe('y pool', function () {
      it('Exact input swap USDT to DAI by exchangeUnderlying', async function () {
        const value = new BN('1000000');
        const answer = await this.ySwap.methods[
          'get_dy_underlying(int128,int128,uint256)'
        ](2, 0, value);
        const data = abi.simpleEncode(
          'exchangeUnderlying(address,address,address,int128,int128,uint256,uint256)',
          this.ySwap.address,
          this.token0.address,
          this.token1.address,
          2,
          0,
          value,
          mulPercent(answer, new BN('100').sub(slippage))
        );
        await this.token0.transfer(this.proxy.address, value, {
          from: providerAddress,
        });
        await this.proxy.updateTokenMock(this.token0.address);
        const receipt = await this.proxy.execMock(this.hCurve.address, data, {
          from: user,
          value: ether('1'), // Ensure handler can correctly deal with ether
        });
        // Get handler return result
        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );
        const token1UserEnd = await this.token1.balanceOf.call(user);
        expect(handlerReturn).to.be.bignumber.eq(token1UserEnd.sub(token1User));

        expect(
          await this.token0.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.zero;
        expect(
          await this.token1.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.zero;
        expect(await this.token0.balanceOf.call(user)).to.be.bignumber.eq(
          token0User
        );
        // get_dy_underlying flow is different from exchange_underlying,
        // so give default 1 bps tolerance for USDT/DAI case.
        expectEqWithinBps(
          await this.token1.balanceOf.call(user),
          token1User.add(answer)
        );
        profileGas(receipt);
      });

      it('Exact input swap USDT to DAI by exchangeUnderlying with max amount', async function () {
        const value = new BN('1000000');
        const answer = await this.ySwap.methods[
          'get_dy_underlying(int128,int128,uint256)'
        ](2, 0, value);
        const data = abi.simpleEncode(
          'exchangeUnderlying(address,address,address,int128,int128,uint256,uint256)',
          this.ySwap.address,
          this.token0.address,
          this.token1.address,
          2,
          0,
          MAX_UINT256,
          mulPercent(answer, new BN('100').sub(slippage))
        );
        await this.token0.transfer(this.proxy.address, value, {
          from: providerAddress,
        });
        await this.proxy.updateTokenMock(this.token0.address);
        const receipt = await this.proxy.execMock(this.hCurve.address, data, {
          from: user,
          value: ether('1'), // Ensure handler can correctly deal with ether
        });
        // Get handler return result
        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );
        const token1UserEnd = await this.token1.balanceOf.call(user);
        expect(handlerReturn).to.be.bignumber.eq(token1UserEnd.sub(token1User));

        expect(
          await this.token0.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.zero;
        expect(
          await this.token1.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.zero;
        expect(await this.token0.balanceOf.call(user)).to.be.bignumber.eq(
          token0User
        );
        // get_dy_underlying flow is different from exchange_underlying,
        // so give default 1 bps tolerance for USDT/DAI case.
        expectEqWithinBps(
          await this.token1.balanceOf.call(user),
          token1User.add(answer)
        );
        profileGas(receipt);
      });
    });
  });

  describe('Exchange', function () {
    describe('3pool pool', function () {
      const token0Address = DAI_TOKEN;
      const token1Address = USDT_TOKEN;

      let token0User;
      let token1User;
      let providerAddress;

      before(async function () {
        providerAddress = await tokenProviderUniV2(token0Address);
        this.token0 = await IToken.at(token0Address);
        this.token1 = await IToken.at(token1Address);
      });

      beforeEach(async function () {
        token0User = await this.token0.balanceOf.call(user);
        token1User = await this.token1.balanceOf.call(user);
      });

      it('Exact input swap DAI to USDT by exchange', async function () {
        const value = ether('1');
        const answer = await this.threeSwap.methods[
          'get_dy(int128,int128,uint256)'
        ](0, 2, value);
        const data = abi.simpleEncode(
          'exchange(address,address,address,int128,int128,uint256,uint256)',
          this.threeSwap.address,
          this.token0.address,
          this.token1.address,
          0,
          2,
          value,
          mulPercent(answer, new BN('100').sub(slippage))
        );

        await this.token0.transfer(this.proxy.address, value, {
          from: providerAddress,
        });
        await this.proxy.updateTokenMock(this.token0.address);
        const receipt = await this.proxy.execMock(this.hCurve.address, data, {
          from: user,
          value: ether('1'), // Ensure handler can correctly deal with ether
        });

        // Get handler return result
        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );
        const token1UserEnd = await this.token1.balanceOf.call(user);
        expect(handlerReturn).to.be.bignumber.eq(token1UserEnd.sub(token1User));

        expect(
          await this.token0.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.zero;
        expect(
          await this.token1.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.zero;
        expect(await this.token0.balanceOf.call(user)).to.be.bignumber.eq(
          token0User
        );
        // get_dy flow is different from exchange,
        // so give 1 wei tolerance for DAI/USDT case.
        expect(await this.token1.balanceOf.call(user)).to.be.bignumber.gte(
          token1User.add(answer).sub(new BN('1'))
        );
        expect(await this.token1.balanceOf.call(user)).to.be.bignumber.lte(
          token1User.add(answer)
        );
        profileGas(receipt);
      });

      it('Exact input swap DAI to USDT by exchange with max amount', async function () {
        const value = ether('1');
        const answer = await this.threeSwap.methods[
          'get_dy(int128,int128,uint256)'
        ](0, 2, value);
        const data = abi.simpleEncode(
          'exchange(address,address,address,int128,int128,uint256,uint256)',
          this.threeSwap.address,
          this.token0.address,
          this.token1.address,
          0,
          2,
          MAX_UINT256,
          mulPercent(answer, new BN('100').sub(slippage))
        );
        await this.token0.transfer(this.proxy.address, value, {
          from: providerAddress,
        });
        await this.proxy.updateTokenMock(this.token0.address);
        const receipt = await this.proxy.execMock(this.hCurve.address, data, {
          from: user,
          value: ether('1'), // Ensure handler can correctly deal with ether
        });

        // Get handler return result
        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );
        const token1UserEnd = await this.token1.balanceOf.call(user);
        expect(handlerReturn).to.be.bignumber.eq(token1UserEnd.sub(token1User));

        expect(
          await this.token0.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.zero;
        expect(
          await this.token1.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.zero;
        expect(await this.token0.balanceOf.call(user)).to.be.bignumber.eq(
          token0User
        );
        // get_dy flow is different from exchange,
        // so give 1 wei tolerance for DAI/USDT case.
        expect(await this.token1.balanceOf.call(user)).to.be.bignumber.gte(
          token1User.add(answer).sub(new BN('1'))
        );
        expect(await this.token1.balanceOf.call(user)).to.be.bignumber.lte(
          token1User.add(answer)
        );
        profileGas(receipt);
      });
    });

    describe('hbtc pool', function () {
      const tokenAddress = HBTC_TOKEN;

      let balanceUser;
      let balanceProxy;
      let tokenUser;
      let providerAddress = HBTC_PROVIDER;

      before(async function () {
        impersonateAndInjectEther(providerAddress);
        this.token = await IToken.at(tokenAddress);
      });

      beforeEach(async function () {
        balanceUser = await tracker(user);
        balanceProxy = await tracker(this.proxy.address);
        tokenUser = await this.token.balanceOf.call(user);
      });

      it('Exact input swap HBTC to WBTC by exchange', async function () {
        const value = ether('1');
        const answer = await this.hbtcSwap.methods[
          'get_dy(int128,int128,uint256)'
        ](0, 1, value);
        const data = abi.simpleEncode(
          'exchange(address,address,address,int128,int128,uint256,uint256)',
          this.hbtcSwap.address,
          this.token.address,
          WBTC_TOKEN,
          0,
          1,
          value,
          mulPercent(answer, new BN('100').sub(slippage))
        );
        await this.token.transfer(this.proxy.address, value, {
          from: providerAddress,
        });
        await this.proxy.updateTokenMock(this.token.address);
        const receipt = await this.proxy.execMock(this.hCurve.address, data, {
          from: user,
          value: ether('1'), // Ensure handler can correctly deal with ether
        });

        // Check handler return
        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );
        const userBalanceDelta = await balanceUser.delta();
        expect(userBalanceDelta).to.be.bignumber.eq(ether('0'));

        // Check proxy
        expect(await balanceProxy.get()).to.be.bignumber.zero;
        expect(
          await this.token.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.zero;

        // Check user
        expect(handlerReturn).to.be.bignumber.lte(answer);
        expect(handlerReturn).to.be.bignumber.gt(
          mulPercent(answer, new BN('100').sub(slippage))
        );
        expect(await this.token.balanceOf.call(user)).to.be.bignumber.eq(
          tokenUser
        );
        profileGas(receipt);
      });
    });

    describe('seth pool', function () {
      const tokenAddress = SETH_TOKEN;

      let balanceUser;
      let balanceProxy;
      let tokenUser;
      let providerAddress;

      before(async function () {
        providerAddress = await tokenProviderUniV2(tokenAddress);

        this.token = await IToken.at(tokenAddress);
      });

      beforeEach(async function () {
        balanceUser = await tracker(user);
        balanceProxy = await tracker(this.proxy.address);
        tokenUser = await this.token.balanceOf.call(user);
      });

      it('Exact input swap ETH to sETH by exchange', async function () {
        const value = ether('1');
        const answer = await this.sethSwap.methods[
          'get_dy(int128,int128,uint256)'
        ](0, 1, value);
        const data = abi.simpleEncode(
          'exchange(address,address,address,int128,int128,uint256,uint256)',
          this.sethSwap.address,
          NATIVE_TOKEN_ADDRESS,
          this.token.address,
          0,
          1,
          value,
          mulPercent(answer, new BN('100').sub(slippage))
        );

        const receipt = await this.proxy.execMock(this.hCurve.address, data, {
          from: user,
          value: value,
        });

        // Check handler return
        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );
        const tokenUserEnd = await this.token.balanceOf.call(user);
        expect(handlerReturn).to.be.bignumber.eq(tokenUserEnd.sub(tokenUser));

        // Check proxy
        expect(await balanceProxy.get()).to.be.bignumber.zero;
        expect(
          await this.token.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.zero;

        // Check user
        expect(await balanceUser.delta()).to.be.bignumber.eq(
          ether('0').sub(value)
        );
        expect(tokenUserEnd).to.be.bignumber.eq(tokenUser.add(answer));
        profileGas(receipt);
      });

      it('Exact input swap sETH to ETH by exchange', async function () {
        const value = ether('1');

        const answer = await this.sethSwap.methods[
          'get_dy(int128,int128,uint256)'
        ](1, 0, value);
        const data = abi.simpleEncode(
          'exchange(address,address,address,int128,int128,uint256,uint256)',
          this.sethSwap.address,
          this.token.address,
          NATIVE_TOKEN_ADDRESS,
          1,
          0,
          value,
          mulPercent(answer, new BN('100').sub(slippage))
        );
        await this.token.transfer(this.proxy.address, value, {
          from: providerAddress,
        });
        await this.proxy.updateTokenMock(this.token.address);
        const receipt = await this.proxy.execMock(this.hCurve.address, data, {
          from: user,
          value: ether('1'), // Ensure handler can correctly deal with ether
        });

        // Check handler return
        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );
        const userBalanceDelta = await balanceUser.delta();
        expect(userBalanceDelta).to.be.bignumber.eq(
          ether('0').add(handlerReturn)
        );

        // Check proxy
        expect(await balanceProxy.get()).to.be.bignumber.zero;
        expect(
          await this.token.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.zero;

        // Check user
        expect(handlerReturn).to.be.bignumber.eq(answer);
        expect(await this.token.balanceOf.call(user)).to.be.bignumber.eq(
          tokenUser
        );
        profileGas(receipt);
      });
    });
  });

  describe('Liquidity', function () {
    describe('3pool pool', function () {
      const token0Address = DAI_TOKEN;
      const token1Address = USDT_TOKEN;
      const poolTokenAddress = CURVE_3POOLCRV;

      let token0User;
      let token1User;
      let provider0Address;
      let provider1Address;
      let poolTokenProvider;

      before(async function () {
        provider0Address = await tokenProviderUniV2(token0Address);
        provider1Address = await tokenProviderUniV2(token1Address);
        poolTokenProvider = await tokenProviderCurveGauge(poolTokenAddress);

        this.token0 = await IToken.at(token0Address);
        this.token1 = await IToken.at(token1Address);
        this.poolToken = await IToken.at(poolTokenAddress);
      });

      beforeEach(async function () {
        token0User = await this.token0.balanceOf.call(user);
        token1User = await this.token1.balanceOf.call(user);
        poolTokenUser = await this.poolToken.balanceOf.call(user);
      });

      it('add DAI and USDT to pool by addLiquidity', async function () {
        const token0Amount = ether('1');
        const token1Amount = new BN('2000000');
        const tokens = [
          this.token0.address,
          constants.ZERO_ADDRESS,
          this.token1.address,
        ];
        const amounts = [token0Amount, 0, token1Amount];

        // Get expected answer
        const answer = await this.threeSwap.methods[
          'calc_token_amount(uint256[3],bool)'
        ](amounts, true);

        // Execute handler
        await this.token0.transfer(this.proxy.address, token0Amount, {
          from: provider0Address,
        });
        await this.token1.transfer(this.proxy.address, token1Amount, {
          from: provider1Address,
        });
        await this.proxy.updateTokenMock(this.token0.address);
        await this.proxy.updateTokenMock(this.token1.address);
        const minMintAmount = mulPercent(answer, new BN('100').sub(slippage));
        const data = abi.simpleEncode(
          'addLiquidity(address,address,address[],uint256[],uint256)',
          this.threeSwap.address,
          this.poolToken.address,
          tokens,
          amounts,
          minMintAmount
        );
        const receipt = await this.proxy.execMock(this.hCurve.address, data, {
          from: user,
          value: ether('1'),
        });

        // Get handler return result
        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );
        const poolTokenUserEnd = await this.poolToken.balanceOf.call(user);
        expect(handlerReturn).to.be.bignumber.eq(
          poolTokenUserEnd.sub(poolTokenUser)
        );

        // Check proxy balance
        expect(
          await this.token0.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.zero;
        expect(
          await this.token1.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.zero;
        expect(
          await this.poolToken.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.zero;

        // Check user balance
        expect(await this.token0.balanceOf.call(user)).to.be.bignumber.eq(
          token0User
        );
        expect(await this.token1.balanceOf.call(user)).to.be.bignumber.eq(
          token1User
        );

        // poolToken amount should be greater than answer * 0.999 which is
        // referenced from tests in curve contract.
        expect(await this.poolToken.balanceOf.call(user)).to.be.bignumber.gte(
          answer.mul(new BN('999')).div(new BN('1000'))
        );
        expect(await this.poolToken.balanceOf.call(user)).to.be.bignumber.lte(
          answer
        );

        profileGas(receipt);
      });

      it('add DAI and USDT to pool by addLiquidity with max amount', async function () {
        const token0Amount = ether('1');
        const token1Amount = new BN('2000000');
        const tokens = [
          this.token0.address,
          constants.ZERO_ADDRESS,
          this.token1.address,
        ];
        const amounts = [token0Amount, 0, token1Amount];

        // Get expected answer
        const answer = await this.threeSwap.methods[
          'calc_token_amount(uint256[3],bool)'
        ](amounts, true);

        // Execute handler
        await this.token0.transfer(this.proxy.address, token0Amount, {
          from: provider0Address,
        });
        await this.token1.transfer(this.proxy.address, token1Amount, {
          from: provider1Address,
        });
        await this.proxy.updateTokenMock(this.token0.address);
        await this.proxy.updateTokenMock(this.token1.address);
        const minMintAmount = mulPercent(answer, new BN('100').sub(slippage));
        const data = abi.simpleEncode(
          'addLiquidity(address,address,address[],uint256[],uint256)',
          this.threeSwap.address,
          this.poolToken.address,
          tokens,
          [MAX_UINT256, 0, MAX_UINT256],
          minMintAmount
        );
        const receipt = await this.proxy.execMock(this.hCurve.address, data, {
          from: user,
          value: ether('1'),
        });

        // Get handler return result
        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );
        const poolTokenUserEnd = await this.poolToken.balanceOf.call(user);
        expect(handlerReturn).to.be.bignumber.eq(
          poolTokenUserEnd.sub(poolTokenUser)
        );

        // Check proxy balance
        expect(
          await this.token0.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.zero;
        expect(
          await this.token1.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.zero;
        expect(
          await this.poolToken.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.zero;

        // Check user balance
        expect(await this.token0.balanceOf.call(user)).to.be.bignumber.eq(
          token0User
        );
        expect(await this.token1.balanceOf.call(user)).to.be.bignumber.eq(
          token1User
        );

        // poolToken amount should be greater than answer * 0.999 which is
        // referenced from tests in curve contract.
        expect(await this.poolToken.balanceOf.call(user)).to.be.bignumber.gte(
          answer.mul(new BN('999')).div(new BN('1000'))
        );
        expect(await this.poolToken.balanceOf.call(user)).to.be.bignumber.lte(
          answer
        );

        profileGas(receipt);
      });

      it('remove from pool to USDT by removeLiquidityOneCoin', async function () {
        const poolTokenUser = ether('0.1');
        const token1UserBefore = await this.token1.balanceOf.call(user);
        const answer = await this.threeSwap.methods[
          'calc_withdraw_one_coin(uint256,int128)'
        ](poolTokenUser, 2);
        await this.poolToken.transfer(this.proxy.address, poolTokenUser, {
          from: poolTokenProvider,
        });
        await this.proxy.updateTokenMock(this.poolToken.address);
        const minAmount = mulPercent(answer, new BN('100').sub(slippage));
        const data = abi.simpleEncode(
          'removeLiquidityOneCoin(address,address,address,uint256,int128,uint256)',
          this.threeSwap.address,
          this.poolToken.address,
          this.token1.address,
          poolTokenUser,
          2,
          minAmount
        );
        const receipt = await this.proxy.execMock(this.hCurve.address, data, {
          from: user,
          value: ether('1'),
        });

        // Get handler return result
        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );
        const token1UserEnd = await this.token1.balanceOf.call(user);
        expect(handlerReturn).to.be.bignumber.eq(
          token1UserEnd.sub(token1UserBefore)
        );

        // Check proxy balance
        expect(
          await this.token1.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.zero;
        expect(
          await this.poolToken.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.zero;

        // amount should be <= answer * 1.001 and >= answer * 0.998 which is
        // referenced from tests in curve contract.
        expect(await this.token1.balanceOf.call(user)).to.be.bignumber.gte(
          token1UserBefore.add(answer.mul(new BN('998')).div(new BN('1000')))
        );
        expect(await this.token1.balanceOf.call(user)).to.be.bignumber.lte(
          token1UserBefore.add(answer.mul(new BN('1001')).div(new BN('1000')))
        );

        profileGas(receipt);
      });

      it('remove from pool to USDT by removeLiquidityOneCoin with max amount', async function () {
        const poolTokenUser = ether('0.1');
        const token1UserBefore = await this.token1.balanceOf.call(user);
        const answer = await this.threeSwap.methods[
          'calc_withdraw_one_coin(uint256,int128)'
        ](poolTokenUser, 2);
        await this.poolToken.transfer(this.proxy.address, poolTokenUser, {
          from: poolTokenProvider,
        });
        await this.proxy.updateTokenMock(this.poolToken.address);
        const minAmount = mulPercent(answer, new BN('100').sub(slippage));
        const data = abi.simpleEncode(
          'removeLiquidityOneCoin(address,address,address,uint256,int128,uint256)',
          this.threeSwap.address,
          this.poolToken.address,
          this.token1.address,
          MAX_UINT256,
          2,
          minAmount
        );
        const receipt = await this.proxy.execMock(this.hCurve.address, data, {
          from: user,
          value: ether('1'),
        });

        // Get handler return result
        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );
        const token1UserEnd = await this.token1.balanceOf.call(user);
        expect(handlerReturn).to.be.bignumber.eq(
          token1UserEnd.sub(token1UserBefore)
        );

        // Check proxy balance
        expect(
          await this.token1.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.zero;
        expect(
          await this.poolToken.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.zero;

        // amount should be <= answer * 1.001 and >= answer * 0.998 which is
        // referenced from tests in curve contract.
        expect(await this.token1.balanceOf.call(user)).to.be.bignumber.gte(
          token1UserBefore.add(answer.mul(new BN('998')).div(new BN('1000')))
        );
        expect(await this.token1.balanceOf.call(user)).to.be.bignumber.lte(
          token1UserBefore.add(answer.mul(new BN('1001')).div(new BN('1000')))
        );

        profileGas(receipt);
      });
    });

    describe('seth pool', function () {
      const tokenAddress = SETH_TOKEN;
      const poolTokenAddress = CURVE_SETHCRV;

      let balanceUser;
      let balanceProxy;
      let tokenUser;
      let providerAddress;
      let poolTokenProvider;

      before(async function () {
        providerAddress = await tokenProviderUniV2(tokenAddress);
        poolTokenProvider = await tokenProviderCurveGauge(poolTokenAddress);

        this.token = await IToken.at(tokenAddress);
        this.poolToken = await IToken.at(poolTokenAddress);
      });

      beforeEach(async function () {
        balanceUser = await tracker(user);
        balanceProxy = await tracker(this.proxy.address);
        tokenUser = await this.token.balanceOf.call(user);
        poolTokenUser = await this.poolToken.balanceOf.call(user);
      });

      it('add ETH and sETH to pool by addLiquidity', async function () {
        const value = ether('1');
        const tokenAmount = ether('2');
        const tokens = [NATIVE_TOKEN_ADDRESS, this.token.address];
        const amounts = [value, tokenAmount];

        // Get expected answer
        const answer = await this.sethSwap.methods[
          'calc_token_amount(uint256[2],bool)'
        ](amounts, true);

        // Execute handler
        await this.token.transfer(this.proxy.address, tokenAmount, {
          from: providerAddress,
        });
        await this.proxy.updateTokenMock(this.token.address);
        const minMintAmount = mulPercent(answer, new BN('100').sub(slippage));
        const data = abi.simpleEncode(
          'addLiquidity(address,address,address[],uint256[],uint256)',
          this.sethSwap.address,
          this.poolToken.address,
          tokens,
          amounts,
          minMintAmount
        );
        const receipt = await this.proxy.execMock(this.hCurve.address, data, {
          from: user,
          value: value,
        });

        // Get handler return
        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );
        const poolTokenUserEnd = await this.poolToken.balanceOf.call(user);
        expect(handlerReturn).to.be.bignumber.eq(
          poolTokenUserEnd.sub(poolTokenUser)
        );

        // Check proxy balance
        expect(await balanceProxy.get()).to.be.bignumber.zero;
        expect(
          await this.token.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.zero;
        expect(
          await this.poolToken.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.zero;

        // Check user balance
        expect(await balanceUser.delta()).to.be.bignumber.eq(
          ether('0').sub(value)
        );
        expect(await this.token.balanceOf.call(user)).to.be.bignumber.eq(
          tokenUser
        );

        // poolToken amount should be greater than answer * 0.999 which is
        // referenced from tests in curve contract.
        expect(await this.poolToken.balanceOf.call(user)).to.be.bignumber.gte(
          answer.mul(new BN('999')).div(new BN('1000'))
        );
        expect(await this.poolToken.balanceOf.call(user)).to.be.bignumber.lte(
          answer
        );

        profileGas(receipt);
      });

      it('add ETH and sETH to pool by addLiquidity with max amount', async function () {
        const value = ether('1');
        const tokenAmount = ether('2');
        const tokens = [NATIVE_TOKEN_ADDRESS, this.token.address];
        const amounts = [value, tokenAmount];

        // Get expected answer
        const answer = await this.sethSwap.methods[
          'calc_token_amount(uint256[2],bool)'
        ](amounts, true);

        // Execute handler
        await this.token.transfer(this.proxy.address, tokenAmount, {
          from: providerAddress,
        });
        await this.proxy.updateTokenMock(this.token.address);
        const minMintAmount = mulPercent(answer, new BN('100').sub(slippage));
        const data = abi.simpleEncode(
          'addLiquidity(address,address,address[],uint256[],uint256)',
          this.sethSwap.address,
          this.poolToken.address,
          tokens,
          [MAX_UINT256, MAX_UINT256],
          minMintAmount
        );
        const receipt = await this.proxy.execMock(this.hCurve.address, data, {
          from: user,
          value: value,
        });

        // Get handler return
        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );
        const poolTokenUserEnd = await this.poolToken.balanceOf.call(user);
        expect(handlerReturn).to.be.bignumber.eq(
          poolTokenUserEnd.sub(poolTokenUser)
        );

        // Check proxy balance
        expect(await balanceProxy.get()).to.be.bignumber.zero;
        expect(
          await this.token.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.zero;
        expect(
          await this.poolToken.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.zero;

        // Check user balance
        expect(await balanceUser.delta()).to.be.bignumber.eq(
          ether('0').sub(value)
        );
        expect(await this.token.balanceOf.call(user)).to.be.bignumber.eq(
          tokenUser
        );

        // poolToken amount should be greater than answer * 0.999 which is
        // referenced from tests in curve contract.
        expect(await this.poolToken.balanceOf.call(user)).to.be.bignumber.gte(
          answer.mul(new BN('999')).div(new BN('1000'))
        );
        expect(await this.poolToken.balanceOf.call(user)).to.be.bignumber.lte(
          answer
        );

        profileGas(receipt);
      });

      it('remove from pool to ETH by removeLiquidityOneCoin', async function () {
        const poolTokenUser = ether('0.1');
        const answer = await this.sethSwap.methods[
          'calc_withdraw_one_coin(uint256,int128)'
        ](poolTokenUser, 0);
        await this.poolToken.transfer(this.proxy.address, poolTokenUser, {
          from: poolTokenProvider,
        });
        await this.proxy.updateTokenMock(this.poolToken.address);
        const minAmount = mulPercent(answer, new BN('100').sub(slippage));
        const data = abi.simpleEncode(
          'removeLiquidityOneCoin(address,address,address,uint256,int128,uint256)',
          this.sethSwap.address,
          this.poolToken.address,
          NATIVE_TOKEN_ADDRESS,
          poolTokenUser,
          0,
          minAmount
        );
        const receipt = await this.proxy.execMock(this.hCurve.address, data, {
          from: user,
          value: ether('1'),
        });

        // Check handler return
        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );
        const userBalanceDelta = await balanceUser.delta();
        expect(userBalanceDelta).to.be.bignumber.eq(
          ether('0').add(handlerReturn)
        );

        // Check proxy balance
        expect(await balanceProxy.get()).to.be.bignumber.zero;
        expect(
          await this.poolToken.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.zero;

        // Check user
        expect(userBalanceDelta).to.be.bignumber.eq(ether('0').add(answer));

        profileGas(receipt);
      });
    });

    describe('hbtc pool', function () {
      const token0Address = HBTC_TOKEN;
      const token1Address = WBTC_TOKEN;
      const poolTokenAddress = CURVE_HBTCCRV;

      let balanceUser;
      let balanceProxy;
      let tokenUser;
      let provider0Address;
      let provider1Address;

      before(async function () {
        provider0Address = await tokenProviderUniV2(token0Address);
        provider1Address = await tokenProviderUniV2(token1Address);

        this.token = await IToken.at(token0Address);
        this.wbtc = await IToken.at(token1Address);
        this.poolToken = await IToken.at(poolTokenAddress);
      });

      beforeEach(async function () {
        balanceUser = await tracker(user);
        balanceProxy = await tracker(this.proxy.address);
        tokenUser = await this.token.balanceOf.call(user);
        poolTokenUser = await this.poolToken.balanceOf.call(user);
      });

      it('add HBTC and WBTC to pool by addLiquidity', async function () {
        const tokenAmount = new BN('100000000');
        const tokens = [this.token.address, this.wbtc.address];
        const amounts = [tokenAmount, tokenAmount];

        // Get expected answer
        const answer = await this.hbtcSwap.methods[
          'calc_token_amount(uint256[2],bool)'
        ](amounts, true);

        // Execute handler
        await this.token.transfer(this.proxy.address, tokenAmount, {
          from: provider0Address,
        });

        await this.wbtc.transfer(this.proxy.address, tokenAmount, {
          from: provider1Address,
        });

        await this.proxy.updateTokenMock(this.token.address);
        const minMintAmount = mulPercent(answer, new BN('100').sub(slippage));
        const data = abi.simpleEncode(
          'addLiquidity(address,address,address[],uint256[],uint256)',
          this.hbtcSwap.address,
          this.poolToken.address,
          tokens,
          amounts,
          minMintAmount
        );
        const receipt = await this.proxy.execMock(this.hCurve.address, data, {
          from: user,
          value: ether('0.1'),
        });

        // Get handler return
        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );
        const poolTokenUserEnd = await this.poolToken.balanceOf.call(user);
        expect(handlerReturn).to.be.bignumber.eq(
          poolTokenUserEnd.sub(poolTokenUser)
        );

        // Check proxy balance
        expect(await balanceProxy.get()).to.be.bignumber.zero;
        expect(
          await this.token.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.zero;
        expect(
          await this.poolToken.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.zero;

        // Check user balance
        expect(await balanceUser.delta()).to.be.bignumber.eq(ether('0'));
        expect(await this.token.balanceOf.call(user)).to.be.bignumber.eq(
          tokenUser
        );

        // poolToken amount should be greater than answer * 0.999 which is
        // referenced from tests in curve contract.
        expect(await this.poolToken.balanceOf.call(user)).to.be.bignumber.gte(
          answer.mul(new BN('999')).div(new BN('1000'))
        );
        expect(await this.poolToken.balanceOf.call(user)).to.be.bignumber.lte(
          answer
        );

        profileGas(receipt);
      });
    });

    describe('aave pool', function () {
      const token0Address = DAI_TOKEN;
      const token1Address = USDT_TOKEN;
      const poolTokenAddress = CURVE_AAVECRV;

      let token0User;
      let token1User;
      let provider0Address;
      let provider1Address;
      let poolTokenProvider;

      before(async function () {
        provider0Address = await tokenProviderUniV2(token0Address);
        provider1Address = await tokenProviderUniV2(token1Address);
        poolTokenProvider = await tokenProviderCurveGauge(poolTokenAddress);

        this.token0 = await IToken.at(token0Address);
        this.token1 = await IToken.at(token1Address);
        this.poolToken = await IToken.at(poolTokenAddress);
      });

      beforeEach(async function () {
        token0User = await this.token0.balanceOf.call(user);
        token1User = await this.token1.balanceOf.call(user);
        poolTokenUser = await this.poolToken.balanceOf.call(user);
      });

      it('add DAI and USDT to pool by addLiquidityUnderlying', async function () {
        const token0Amount = ether('1');
        const token1Amount = new BN('2000000');
        const tokens = [
          this.token0.address,
          constants.ZERO_ADDRESS,
          this.token1.address,
        ];
        const amounts = [token0Amount, 0, token1Amount];

        // Get expected answer
        const answer = await this.aaveSwap.methods[
          'calc_token_amount(uint256[3],bool)'
        ](amounts, true);

        // Execute handler
        await this.token0.transfer(this.proxy.address, token0Amount, {
          from: provider0Address,
        });
        await this.token1.transfer(this.proxy.address, token1Amount, {
          from: provider1Address,
        });
        await this.proxy.updateTokenMock(this.token0.address);
        await this.proxy.updateTokenMock(this.token1.address);
        const minMintAmount = mulPercent(answer, new BN('100').sub(slippage));
        const data = abi.simpleEncode(
          'addLiquidityUnderlying(address,address,address[],uint256[],uint256)',
          this.aaveSwap.address,
          this.poolToken.address,
          tokens,
          amounts,
          minMintAmount
        );
        const receipt = await this.proxy.execMock(this.hCurve.address, data, {
          from: user,
          value: ether('1'),
        });

        // Get handler return result
        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );
        const poolTokenUserEnd = await this.poolToken.balanceOf.call(user);
        expect(handlerReturn).to.be.bignumber.eq(
          poolTokenUserEnd.sub(poolTokenUser)
        );

        // Check proxy balance
        expect(
          await this.token0.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.zero;
        expect(
          await this.token1.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.zero;
        expect(
          await this.poolToken.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.zero;

        // Check user balance
        expect(await this.token0.balanceOf.call(user)).to.be.bignumber.eq(
          token0User
        );
        expect(await this.token1.balanceOf.call(user)).to.be.bignumber.eq(
          token1User
        );
        // poolToken amount should be greater than answer * 0.999 which is
        // referenced from tests in curve contract.
        expect(poolTokenUserEnd).to.be.bignumber.gte(
          answer.mul(new BN('999')).div(new BN('1000'))
        );
        expect(poolTokenUserEnd).to.be.bignumber.lte(answer);

        profileGas(receipt);
      });

      it('remove from pool to USDT by removeLiquidityOneCoinUnderlying', async function () {
        const poolTokenUser = ether('0.1');
        const token1UserBefore = await this.token1.balanceOf.call(user);
        const answer = await this.aaveSwap.methods[
          'calc_withdraw_one_coin(uint256,int128)'
        ](poolTokenUser, 2);
        await this.poolToken.transfer(this.proxy.address, poolTokenUser, {
          from: poolTokenProvider,
        });
        await this.proxy.updateTokenMock(this.poolToken.address);
        const minAmount = mulPercent(answer, new BN('100').sub(slippage));
        const data = abi.simpleEncode(
          'removeLiquidityOneCoinUnderlying(address,address,address,uint256,int128,uint256)',
          this.aaveSwap.address,
          this.poolToken.address,
          this.token1.address,
          poolTokenUser,
          2,
          minAmount
        );
        const receipt = await this.proxy.execMock(this.hCurve.address, data, {
          from: user,
          value: ether('1'),
        });

        // Get handler return result
        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );
        const token1UserEnd = await this.token1.balanceOf.call(user);
        expect(handlerReturn).to.be.bignumber.eq(
          token1UserEnd.sub(token1UserBefore)
        );

        // Check proxy balance
        expect(
          await this.token1.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.zero;
        expect(
          await this.poolToken.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.zero;

        // Check user
        expect(token1UserEnd).to.be.bignumber.eq(token1UserBefore.add(answer));

        profileGas(receipt);
      });
    });
  });

  describe('Liquidity with deposit contract', function () {
    describe('y pool', function () {
      const token0Address = DAI_TOKEN;
      const token1Address = USDT_TOKEN;
      const yToken0Address = CURVE_YDAI_TOKEN;
      const yToken1Address = CURVE_YUSDT_TOKEN;
      const poolTokenAddress = CURVE_YCRV;

      let token0User;
      let token1User;
      let provider0Address;
      let provider1Address;
      let poolTokenProvider;

      before(async function () {
        provider0Address = await tokenProviderUniV2(token0Address);
        provider1Address = await tokenProviderUniV2(token1Address);
        poolTokenProvider = await tokenProviderCurveGauge(poolTokenAddress);

        this.token0 = await IToken.at(token0Address);
        this.token1 = await IToken.at(token1Address);
        this.yToken0 = await IYToken.at(yToken0Address);
        this.yToken1 = await IYToken.at(yToken1Address);
        this.poolToken = await IToken.at(poolTokenAddress);
      });
      beforeEach(async function () {
        token0User = await this.token0.balanceOf.call(user);
        token1User = await this.token1.balanceOf.call(user);
        poolTokenUser = await this.poolToken.balanceOf.call(user);
      });
      it('add DAI and USDT to pool by addLiquidity', async function () {
        const token0Amount = ether('1000');
        const token1Amount = new BN('1000000000');
        // Get yToken amounts equivalent to underlying token inputs
        await this.token0.transfer(user, token0Amount, {
          from: provider0Address,
        });
        await this.token1.transfer(user, token1Amount, {
          from: provider1Address,
        });
        await this.token0.approve(this.yToken0.address, token0Amount, {
          from: user,
        });
        await this.token1.approve(this.yToken1.address, token1Amount, {
          from: user,
        });
        await this.yToken0.deposit(token0Amount, {
          from: user,
        });
        await this.yToken1.deposit(token1Amount, {
          from: user,
        });
        // Get expected answer
        const answer = await this.ySwap.methods[
          'calc_token_amount(uint256[4],bool)'
        ](
          [
            await this.yToken0.balanceOf.call(user), // yDAI
            0, // yUSDC
            await this.yToken1.balanceOf.call(user), // yUSDT
            0, // yTUSD
          ],
          true
        );
        // Execute handler
        await this.token0.transfer(this.proxy.address, token0Amount, {
          from: provider0Address,
        });
        await this.token1.transfer(this.proxy.address, token1Amount, {
          from: provider1Address,
        });
        await this.proxy.updateTokenMock(this.token0.address);
        await this.proxy.updateTokenMock(this.token1.address);
        const tokens = [
          this.token0.address,
          constants.ZERO_ADDRESS,
          this.token1.address,
          constants.ZERO_ADDRESS,
        ];
        const amounts = [token0Amount, 0, token1Amount, 0];
        const minMintAmount = mulPercent(answer, new BN('100').sub(slippage));
        const data = abi.simpleEncode(
          'addLiquidity(address,address,address[],uint256[],uint256)',
          this.yDeposit.address,
          this.poolToken.address,
          tokens,
          amounts,
          minMintAmount
        );
        const receipt = await this.proxy.execMock(this.hCurve.address, data, {
          from: user,
          value: ether('1'),
        });
        // Get handler return result
        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );
        const poolTokenUserEnd = await this.poolToken.balanceOf.call(user);
        expect(handlerReturn).to.be.bignumber.eq(
          poolTokenUserEnd.sub(poolTokenUser)
        );
        // Check proxy balance
        expect(
          await this.token0.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.zero;
        expect(
          await this.token1.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.zero;
        expect(
          await this.poolToken.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.zero;
        // Check user balance
        expect(await this.token0.balanceOf.call(user)).to.be.bignumber.eq(
          token0User
        );
        expect(await this.token1.balanceOf.call(user)).to.be.bignumber.eq(
          token1User
        );
        // yToken --> y pool estimation is inaccurate, set 10% tolerance.
        expect(await this.poolToken.balanceOf.call(user)).to.be.bignumber.gte(
          mulPercent(answer, 90)
        );
        profileGas(receipt);
      });
      it('add DAI and USDT to pool by addLiquidity with max amount', async function () {
        const token0Amount = ether('1000');
        const token1Amount = new BN('1000000000');
        // Get yToken amounts equivalent to underlying token inputs
        await this.token0.transfer(user, token0Amount, {
          from: provider0Address,
        });
        await this.token1.transfer(user, token1Amount, {
          from: provider1Address,
        });
        await this.token0.approve(this.yToken0.address, token0Amount, {
          from: user,
        });
        await this.token1.approve(this.yToken1.address, token1Amount, {
          from: user,
        });
        await this.yToken0.deposit(token0Amount, {
          from: user,
        });
        await this.yToken1.deposit(token1Amount, {
          from: user,
        });
        // Get expected answer
        const answer = await this.ySwap.methods[
          'calc_token_amount(uint256[4],bool)'
        ](
          [
            await this.yToken0.balanceOf.call(user), // yDAI
            0, // yUSDC
            await this.yToken1.balanceOf.call(user), // yUSDT
            0, // yTUSD
          ],
          true
        );
        // Execute handler
        await this.token0.transfer(this.proxy.address, token0Amount, {
          from: provider0Address,
        });
        await this.token1.transfer(this.proxy.address, token1Amount, {
          from: provider1Address,
        });
        await this.proxy.updateTokenMock(this.token0.address);
        await this.proxy.updateTokenMock(this.token1.address);
        const tokens = [
          this.token0.address,
          constants.ZERO_ADDRESS,
          this.token1.address,
          constants.ZERO_ADDRESS,
        ];
        const amounts = [MAX_UINT256, 0, MAX_UINT256, 0];
        const minMintAmount = mulPercent(answer, new BN('100').sub(slippage));
        const data = abi.simpleEncode(
          'addLiquidity(address,address,address[],uint256[],uint256)',
          this.yDeposit.address,
          this.poolToken.address,
          tokens,
          amounts,
          minMintAmount
        );
        const receipt = await this.proxy.execMock(this.hCurve.address, data, {
          from: user,
          value: ether('1'),
        });
        // Get handler return result
        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );
        const poolTokenUserEnd = await this.poolToken.balanceOf.call(user);
        expect(handlerReturn).to.be.bignumber.eq(
          poolTokenUserEnd.sub(poolTokenUser)
        );
        // Check proxy balance
        expect(
          await this.token0.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.zero;
        expect(
          await this.token1.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.zero;
        expect(
          await this.poolToken.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.zero;
        // Check user balance
        expect(await this.token0.balanceOf.call(user)).to.be.bignumber.eq(
          token0User
        );
        expect(await this.token1.balanceOf.call(user)).to.be.bignumber.eq(
          token1User
        );
        // yToken --> y pool estimation is inaccurate, set 10% tolerance.
        expect(await this.poolToken.balanceOf.call(user)).to.be.bignumber.gte(
          mulPercent(answer, 90)
        );
        profileGas(receipt);
      });
      it('remove from pool to USDT by removeLiquidityOneCoinUnderlying', async function () {
        const token1UserBefore = await this.token1.balanceOf.call(user);
        const poolTokenUser = ether('1');
        const answer = await this.yDeposit.methods[
          'calc_withdraw_one_coin(uint256,int128)'
        ](poolTokenUser, 2);
        await this.poolToken.transfer(this.proxy.address, poolTokenUser, {
          from: poolTokenProvider,
        });
        await this.proxy.updateTokenMock(this.poolToken.address);
        const minAmount = mulPercent(answer, new BN('100').sub(slippage));
        const data = abi.simpleEncode(
          'removeLiquidityOneCoinUnderlying(address,address,address,uint256,int128,uint256)',
          this.yDeposit.address,
          this.poolToken.address,
          this.token1.address,
          poolTokenUser,
          2,
          minAmount
        );
        const receipt = await this.proxy.execMock(this.hCurve.address, data, {
          from: user,
          value: ether('1'),
        });
        // Get handler return result
        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );
        const token1UserEnd = await this.token1.balanceOf.call(user);
        expect(handlerReturn).to.be.bignumber.eq(token1UserEnd.sub(token1User));
        // Check proxy balance
        expect(
          await this.token1.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.zero;
        expect(
          await this.poolToken.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.zero;
        // amount should be <= answer * 1.001 and >= answer * 0.999 which is
        // referenced from tests in curve contract.
        expect(await this.token1.balanceOf.call(user)).to.be.bignumber.gte(
          token1UserBefore.add(answer.mul(new BN('999')).div(new BN('1000')))
        );
        expect(await this.token1.balanceOf.call(user)).to.be.bignumber.lte(
          token1UserBefore.add(answer.mul(new BN('1001')).div(new BN('1000')))
        );
        profileGas(receipt);
      });
    });
  });
});
