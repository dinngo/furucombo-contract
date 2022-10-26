if (network.config.chainId == 1) {
  // This test supports to run on these chains.
} else {
  return;
}

const { BN, ether, constants, send } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');
const abi = require('ethereumjs-abi');
const utils = web3.utils;
const {
  USDN_TOKEN,
  USDT_TOKEN,
  CURVE_USDN_SWAP,
  CURVE_USDN_DEPOSIT,
  CURVE_USDNCRV,
} = require('./utils/constants');
const {
  evmRevert,
  evmSnapshot,
  mulPercent,
  profileGas,
  tokenProviderUniV2,
  tokenProviderCurveGauge,
} = require('./utils/utils');

const FeeRuleRegistry = artifacts.require('FeeRuleRegistry');
const Proxy = artifacts.require('ProxyMock');
const Registry = artifacts.require('Registry');
const HCurve = artifacts.require('HCurve');
const ICurveHandler = artifacts.require('ICurveHandler');
const IToken = artifacts.require('IERC20');

contract('Curve Meta', function([_, user]) {
  const slippage = new BN('3');
  let id;
  before(async function() {
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
    this.usdnSwap = await ICurveHandler.at(CURVE_USDN_SWAP);
    this.usdnDeposit = await ICurveHandler.at(CURVE_USDN_DEPOSIT);
  });

  beforeEach(async function() {
    id = await evmSnapshot();
  });

  afterEach(async function() {
    await evmRevert(id);
  });

  describe('Exchange underlying', function() {
    const token0Address = USDT_TOKEN;
    const token1Address = USDN_TOKEN;

    let token0User;
    let token1User;
    let providerAddress;

    before(async function() {
      providerAddress = await tokenProviderUniV2(token0Address);

      this.token0 = await IToken.at(token0Address);
      this.token1 = await IToken.at(token1Address);
    });

    beforeEach(async function() {
      token0User = await this.token0.balanceOf.call(user);
      token1User = await this.token1.balanceOf.call(user);
    });

    describe('usdn meta pool', function() {
      it('Exact input swap USDT to USDN by exchangeUnderlying', async function() {
        // 0: USDN, 1: DAI, 2: USDC, 3: USDT
        const value = new BN('1000000');
        const answer = await this.usdnSwap.methods[
          'get_dy_underlying(int128,int128,uint256)'
        ](3, 0, value);
        const data = abi.simpleEncode(
          'exchangeUnderlying(address,address,address,int128,int128,uint256,uint256)',
          this.usdnSwap.address,
          this.token0.address,
          this.token1.address,
          3,
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
        expect(
          await this.token0.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.eq(ether('0'));
        expect(
          await this.token1.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.eq(ether('0'));
        expect(await this.token0.balanceOf.call(user)).to.be.bignumber.eq(
          token0User
        );
        // get_dy_underlying flow is different from exchange_underlying,
        // and actual balance is larger than expectation.
        expect(await this.token1.balanceOf.call(user)).to.be.bignumber.gte(
          token1User.add(mulPercent(answer, new BN('99')))
        );

        expect(await this.token1.balanceOf.call(user)).to.be.bignumber.lte(
          token1User.add(mulPercent(answer, new BN('101')))
        );
        profileGas(receipt);
      });
    });
  });

  describe('Liquidity', function() {
    const token0Address = USDN_TOKEN;
    const token1Address = USDT_TOKEN;
    const poolTokenAddress = CURVE_USDNCRV;

    let token0User;
    let token1User;
    let provider0Address;
    let provider1Address;
    let poolTokenProvider;

    before(async function() {
      provider0Address = await tokenProviderUniV2(token0Address);
      provider1Address = await tokenProviderUniV2(token1Address);
      poolTokenProvider = await tokenProviderCurveGauge(poolTokenAddress);

      this.token0 = await IToken.at(token0Address);
      this.token1 = await IToken.at(token1Address);
      this.poolToken = await IToken.at(poolTokenAddress);
    });

    beforeEach(async function() {
      token0User = await this.token0.balanceOf.call(user);
      token1User = await this.token1.balanceOf.call(user);
    });

    describe('usdn meta pool', function() {
      it('Add USDN and USDT to pool by addLiquidity', async function() {
        const token0Amount = ether('1');
        const token1Amount = new BN('1000000');
        const tokens = [
          this.token0.address,
          constants.ZERO_ADDRESS,
          constants.ZERO_ADDRESS,
          this.token1.address,
        ];
        const amounts = [token0Amount, 0, 0, token1Amount];

        // Get expected answer
        const answer = await this.usdnDeposit.methods[
          'calc_token_amount(uint256[4],bool)'
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
          this.usdnDeposit.address,
          this.poolToken.address,
          tokens,
          amounts,
          minMintAmount
        );
        const receipt = await this.proxy.execMock(this.hCurve.address, data, {
          from: user,
          value: ether('1'),
        });

        // Check proxy balance
        expect(
          await this.token0.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.eq(ether('0'));
        expect(
          await this.token1.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.eq(ether('0'));
        expect(
          await this.poolToken.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.eq(ether('0'));

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

        profileGas(receipt);
      });

      it('Remove from pool to USDN by removeLiquidityOneCoin', async function() {
        const poolTokenUser = ether('1');
        const token0UserBefore = await this.token0.balanceOf.call(user);
        const answer = await this.usdnDeposit.methods[
          'calc_withdraw_one_coin(uint256,int128)'
        ](poolTokenUser, 0);

        await this.poolToken.transfer(this.proxy.address, poolTokenUser, {
          from: poolTokenProvider,
        });
        await this.proxy.updateTokenMock(this.poolToken.address);
        const minAmount = mulPercent(answer, new BN('100').sub(slippage));
        const data = abi.simpleEncode(
          'removeLiquidityOneCoin(address,address,address,uint256,int128,uint256)',
          this.usdnDeposit.address,
          this.poolToken.address,
          this.token0.address,
          poolTokenUser,
          0,
          minAmount
        );
        const receipt = await this.proxy.execMock(this.hCurve.address, data, {
          from: user,
          value: ether('1'),
        });

        // Check proxy balance
        expect(
          await this.token0.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.eq(ether('0'));
        expect(
          await this.poolToken.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.eq(ether('0'));

        // amount should be <= answer * 1.001 and >= answer * 0.998 which is
        // referenced from tests in curve contract.
        expect(await this.token0.balanceOf.call(user)).to.be.bignumber.gte(
          token0UserBefore.add(answer.mul(new BN('998')).div(new BN('1000')))
        );
        expect(await this.token0.balanceOf.call(user)).to.be.bignumber.lte(
          token0UserBefore.add(answer.mul(new BN('1001')).div(new BN('1000')))
        );

        profileGas(receipt);
      });
    });
  });
});
