if (network.config.chainId == 137) {
  // This test supports to run on these chains.

  // Due to Aave governance 224 issue, skip temporary
  return;
} else {
  return;
}

const {
  BN,
  ether,
  constants,
  expectRevert,
} = require('@openzeppelin/test-helpers');
const { web3 } = require('@openzeppelin/test-helpers/src/setup');
const { MAX_UINT256 } = constants;
const { expect } = require('chai');
const abi = require('ethereumjs-abi');
const utils = web3.utils;
const {
  DAI_TOKEN,
  USDT_TOKEN,
  CURVE_AAVE_SWAP,
  CURVE_AAVECRV,
} = require('./utils/constants');
const {
  evmRevert,
  evmSnapshot,
  mulPercent,
  profileGas,
  getHandlerReturn,
  getTokenProvider,
  tokenProviderCurveGauge,
} = require('./utils/utils');

const Proxy = artifacts.require('ProxyMock');
const Registry = artifacts.require('Registry');
const FeeRuleRegistry = artifacts.require('FeeRuleRegistry');
const HCurve = artifacts.require('HCurve');
const ICurveHandler = artifacts.require('ICurveHandler');
const IToken = artifacts.require('IERC20');

contract('Curve_polygon', function ([_, user]) {
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
      providerAddress = await getTokenProvider(token0Address);

      this.token0 = await IToken.at(token0Address);
      this.token1 = await IToken.at(token1Address);
    });

    beforeEach(async function () {
      token0User = await this.token0.balanceOf(user);
      token1User = await this.token1.balanceOf(user);
    });

    describe('aave pool', function () {
      it('Exact input swap USDT to DAI by exchangeUnderlying', async function () {
        const value = new BN('1000000');
        const answer = await this.aaveSwap.methods[
          'get_dy_underlying(int128,int128,uint256)'
        ](2, 0, value);
        const data = abi.simpleEncode(
          'exchangeUnderlying(address,address,address,int128,int128,uint256,uint256)',
          this.aaveSwap.address,
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
        const token1UserEnd = await this.token1.balanceOf(user);
        expect(handlerReturn).to.be.bignumber.eq(token1UserEnd.sub(token1User));

        expect(
          await this.token0.balanceOf(this.proxy.address)
        ).to.be.bignumber.zero;
        expect(
          await this.token1.balanceOf(this.proxy.address)
        ).to.be.bignumber.zero;
        expect(await this.token0.balanceOf(user)).to.be.bignumber.eq(
          token0User
        );
        // get_dy_underlying flow is different from exchange_underlying,
        // so give 1*10^12 tolerance for USDT/DAI case.
        expect(await this.token1.balanceOf(user)).to.be.bignumber.gte(
          token1User.add(answer).sub(new BN('1000000000000'))
        );
        expect(await this.token1.balanceOf(user)).to.be.bignumber.lte(
          mulPercent(token1User.add(answer), new BN('101'))
        );
        profileGas(receipt);
      });

      it('Exact input swap USDT to DAI by exchangeUnderlying with max amount', async function () {
        const value = new BN('1000000');
        const answer = await this.aaveSwap.methods[
          'get_dy_underlying(int128,int128,uint256)'
        ](2, 0, value);
        const data = abi.simpleEncode(
          'exchangeUnderlying(address,address,address,int128,int128,uint256,uint256)',
          this.aaveSwap.address,
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
        const token1UserEnd = await this.token1.balanceOf(user);
        expect(handlerReturn).to.be.bignumber.eq(token1UserEnd.sub(token1User));

        expect(
          await this.token0.balanceOf(this.proxy.address)
        ).to.be.bignumber.zero;
        expect(
          await this.token1.balanceOf(this.proxy.address)
        ).to.be.bignumber.zero;
        expect(await this.token0.balanceOf(user)).to.be.bignumber.eq(
          token0User
        );
        // get_dy_underlying flow is different from exchange_underlying,
        // so give 1*10^12 tolerance for USDT/DAI case.
        expect(await this.token1.balanceOf(user)).to.be.bignumber.gte(
          token1User.add(answer).sub(new BN('1000000000000'))
        );
        expect(await this.token1.balanceOf(user)).to.be.bignumber.lte(
          mulPercent(token1User.add(answer), new BN('101'))
        );
        profileGas(receipt);
      });
    });
  });

  describe('Liquidity Underlying', function () {
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
        provider0Address = await getTokenProvider(token0Address);
        provider1Address = await getTokenProvider(token1Address);
        poolTokenProvider = await tokenProviderCurveGauge(poolTokenAddress);

        this.token0 = await IToken.at(token0Address);
        this.token1 = await IToken.at(token1Address);
        this.poolToken = await IToken.at(poolTokenAddress);
      });

      beforeEach(async function () {
        token0User = await this.token0.balanceOf(user);
        token1User = await this.token1.balanceOf(user);
        poolTokenUser = await this.poolToken.balanceOf(user);
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
        const poolTokenUserEnd = await this.poolToken.balanceOf(user);
        expect(handlerReturn).to.be.bignumber.eq(
          poolTokenUserEnd.sub(poolTokenUser)
        );

        // Check proxy balance
        expect(
          await this.token0.balanceOf(this.proxy.address)
        ).to.be.bignumber.zero;
        expect(
          await this.token1.balanceOf(this.proxy.address)
        ).to.be.bignumber.zero;
        expect(
          await this.poolToken.balanceOf(this.proxy.address)
        ).to.be.bignumber.zero;

        // Check user balance
        expect(await this.token0.balanceOf(user)).to.be.bignumber.eq(
          token0User
        );
        expect(await this.token1.balanceOf(user)).to.be.bignumber.eq(
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
        const token1UserBefore = await this.token1.balanceOf(user);
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
        const token1UserEnd = await this.token1.balanceOf(user);
        expect(handlerReturn).to.be.bignumber.eq(
          token1UserEnd.sub(token1UserBefore)
        );

        // Check proxy balance
        expect(
          await this.token1.balanceOf(this.proxy.address)
        ).to.be.bignumber.zero;
        expect(
          await this.poolToken.balanceOf(this.proxy.address)
        ).to.be.bignumber.zero;

        // Check user
        expect(token1UserEnd).to.be.bignumber.eq(token1UserBefore.add(answer));

        profileGas(receipt);
      });
    });
  });
});
