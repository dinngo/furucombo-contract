const { BN, ether, constants } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');
const abi = require('ethereumjs-abi');
const utils = web3.utils;
const {
  MUSD_TOKEN,
  USDT_TOKEN,
  USDT_PROVIDER,
  MUSD_PROVIDER,
  CURVE_MUSD_SWAP,
  CURVE_MUSD_DEPOSIT,
  CURVE_MUSDCRV,
  CURVE_MUSDCRV_PROVIDER,
} = require('./utils/constants');
const {
  evmRevert,
  evmSnapshot,
  mulPercent,
  profileGas,
} = require('./utils/utils');

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
    this.proxy = await Proxy.new(this.registry.address);
    this.musdSwap = await ICurveHandler.at(CURVE_MUSD_SWAP);
    this.musdDeposit = await ICurveHandler.at(CURVE_MUSD_DEPOSIT);
  });

  beforeEach(async function() {
    id = await evmSnapshot();
  });

  afterEach(async function() {
    await evmRevert(id);
  });

  describe('Exchange underlying', function() {
    const token0Address = USDT_TOKEN;
    const token1Address = MUSD_TOKEN;
    const providerAddress = USDT_PROVIDER;

    let token0User;
    let token1User;

    before(async function() {
      this.token0 = await IToken.at(token0Address);
      this.token1 = await IToken.at(token1Address);
    });

    beforeEach(async function() {
      token0User = await this.token0.balanceOf.call(user);
      token1User = await this.token1.balanceOf.call(user);
    });

    describe('musd meta pool', function() {
      it('Exact input swap USDT to mUSD by exchangeUnderlying', async function() {
        // 0: mUSD, 1: DAI, 2: USDC, 3: USDT
        const value = new BN('1000000');
        const answer = await this.musdSwap.get_dy_underlying.call(3, 0, value, {
          from: user,
        });
        const data = abi.simpleEncode(
          'exchangeUnderlying(address,address,address,int128,int128,uint256,uint256)',
          this.musdSwap.address,
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
          token1User.add(answer)
        );
        profileGas(receipt);
      });
    });
  });

  describe('Liquidity', function() {
    const token0Address = MUSD_TOKEN;
    const token1Address = USDT_TOKEN;
    const provider0Address = MUSD_PROVIDER;
    const provider1Address = USDT_PROVIDER;
    const poolTokenAddress = CURVE_MUSDCRV;
    const poolTokenProvider = CURVE_MUSDCRV_PROVIDER;

    let token0User;
    let token1User;

    before(async function() {
      this.token0 = await IToken.at(token0Address);
      this.token1 = await IToken.at(token1Address);
      this.poolToken = await IToken.at(poolTokenAddress);
    });

    beforeEach(async function() {
      token0User = await this.token0.balanceOf.call(user);
      token1User = await this.token1.balanceOf.call(user);
    });

    describe('musd meta pool', function() {
      it('Add mUSD and USDT to pool by addLiquidity', async function() {
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
        const answer = await this.musdDeposit.methods[
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
          this.musdDeposit.address,
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

      it('Remove from pool to mUSD by removeLiquidityOneCoin', async function() {
        const poolTokenUser = ether('1');
        const token0UserBefore = await this.token0.balanceOf.call(user);
        const answer = await this.musdDeposit.calc_withdraw_one_coin.call(
          poolTokenUser,
          0
        );
        await this.poolToken.transfer(this.proxy.address, poolTokenUser, {
          from: poolTokenProvider,
        });
        await this.proxy.updateTokenMock(this.poolToken.address);
        const minAmount = mulPercent(answer, new BN('100').sub(slippage));
        const data = abi.simpleEncode(
          'removeLiquidityOneCoin(address,address,address,uint256,int128,uint256)',
          this.musdDeposit.address,
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
