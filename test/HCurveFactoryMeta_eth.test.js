if (network.config.chainId == 1) {
  // This test supports to run on these chains.
} else {
  return;
}

const { balance, BN, ether, constants } = require('@openzeppelin/test-helpers');
const { web3 } = require('@openzeppelin/test-helpers/src/setup');
const { tracker } = balance;
const { expect } = require('chai');
const abi = require('ethereumjs-abi');
const utils = web3.utils;
const {
  USDT_TOKEN,
  TUSD_TOKEN,
  CURVE_FACTORY_ZAP_3POOL,
  CURVE_FACTORY_TUSD,
} = require('./utils/constants');
const {
  evmRevert,
  evmSnapshot,
  mulPercent,
  profileGas,
  getHandlerReturn,
  tokenProviderUniV2,
  tokenProviderCurveGauge,
} = require('./utils/utils');

const FeeRuleRegistry = artifacts.require('FeeRuleRegistry');
const Proxy = artifacts.require('ProxyMock');
const Registry = artifacts.require('Registry');
const HCurve = artifacts.require('HCurve');
const ICurveHandler = artifacts.require('ICurveHandler');
const IToken = artifacts.require('IERC20');

contract('Curve Factory Meta', function ([_, user]) {
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
    this.zap3Pool = await ICurveHandler.at(CURVE_FACTORY_ZAP_3POOL);
  });

  beforeEach(async function () {
    id = await evmSnapshot();
  });

  afterEach(async function () {
    await evmRevert(id);
  });

  describe('Liquidity', function () {
    describe('factory tusd pool', function () {
      const token0Address = TUSD_TOKEN;
      const token1Address = USDT_TOKEN;
      const poolTokenAddress = CURVE_FACTORY_TUSD;

      let token0, token1, poolToken;
      let balanceProxy, token0User, token1User, poolTokenUser;
      let provider0Address;
      let provider1Address;
      let poolTokenProvider;

      before(async function () {
        provider0Address = await tokenProviderUniV2(token0Address);
        provider1Address = await tokenProviderUniV2(token1Address);
        poolTokenProvider = await tokenProviderCurveGauge(poolTokenAddress);

        token0 = await IToken.at(token0Address);
        token1 = await IToken.at(token1Address);
        poolToken = await IToken.at(poolTokenAddress);
      });

      beforeEach(async function () {
        balanceProxy = await tracker(this.proxy.address);
        token0User = await token0.balanceOf.call(user);
        token1User = await token1.balanceOf.call(user);
        poolTokenUser = await poolToken.balanceOf.call(user);
      });

      afterEach(async function () {
        // Check handler
        expect(handlerReturn).to.be.bignumber.gte(mulPercent(answer, 99));
        expect(handlerReturn).to.be.bignumber.lte(mulPercent(answer, 101));

        // Check proxy
        expect(await balanceProxy.get()).to.be.bignumber.zero;
        expect(
          await token0.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.zero;
        expect(
          await token1.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.zero;
        expect(
          await poolToken.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.zero;

        profileGas(receipt);
      });

      it('add TUSD and USDT to pool by addLiquidityFactoryZap', async function () {
        const token0Amount = ether('100');
        const token1Amount = new BN('100000000'); // 1e8
        const tokens = [
          token0.address,
          constants.ZERO_ADDRESS,
          constants.ZERO_ADDRESS,
          token1.address,
        ];
        const amounts = [token0Amount, new BN('0'), new BN('0'), token1Amount];

        // Get expected answer
        answer = await this.zap3Pool.methods[
          'calc_token_amount(address,uint256[4],bool)'
        ](poolTokenAddress, amounts, true);

        // Execute handler
        await token0.transfer(this.proxy.address, token0Amount, {
          from: provider0Address,
        });
        await token1.transfer(this.proxy.address, token1Amount, {
          from: provider1Address,
        });
        await this.proxy.updateTokenMock(token0.address);
        await this.proxy.updateTokenMock(token1.address);
        const minMintAmount = mulPercent(answer, new BN('100').sub(slippage));
        const data = abi.simpleEncode(
          'addLiquidityFactoryZap(address,address,address[],uint256[],uint256)',
          this.zap3Pool.address,
          poolToken.address,
          tokens,
          amounts,
          minMintAmount
        );
        receipt = await this.proxy.execMock(this.hCurve.address, data, {
          from: user,
          value: ether('1'), // Ensure handler can correctly deal with ether
        });
        handlerReturn = utils.toBN(getHandlerReturn(receipt, ['uint256'])[0]);

        // Check user
        expect(await token0.balanceOf.call(user)).to.be.bignumber.eq(
          token0User
        );
        expect(await token1.balanceOf.call(user)).to.be.bignumber.eq(
          token1User
        );
        expect(await poolToken.balanceOf.call(user)).to.be.bignumber.eq(
          handlerReturn.add(poolTokenUser)
        );
      });

      it('remove from pool to TUSD by removeLiquidityOneCoinFactoryZap', async function () {
        const amount = ether('0.1');
        answer = await this.zap3Pool.methods[
          'calc_withdraw_one_coin(address,uint256,int128)'
        ](poolTokenAddress, amount, 0);
        await poolToken.transfer(this.proxy.address, amount, {
          from: poolTokenProvider,
        });
        await this.proxy.updateTokenMock(poolToken.address);
        const minAmount = mulPercent(answer, new BN('100').sub(slippage));
        const data = abi.simpleEncode(
          'removeLiquidityOneCoinFactoryZap(address,address,address,uint256,int128,uint256)',
          this.zap3Pool.address,
          poolToken.address,
          token0.address,
          amount,
          0,
          minAmount
        );
        receipt = await this.proxy.execMock(this.hCurve.address, data, {
          from: user,
          value: ether('1'), // Ensure handler can correctly deal with ether
        });
        handlerReturn = utils.toBN(getHandlerReturn(receipt, ['uint256'])[0]);

        // Check user
        expect(await token0.balanceOf.call(user)).to.be.bignumber.eq(
          handlerReturn.add(token0User)
        );
      });
    });
  });
});
