const { balance, BN, ether, constants } = require('@openzeppelin/test-helpers');
const { MAX_UINT256 } = require('@openzeppelin/test-helpers/src/constants');
const { web3 } = require('@openzeppelin/test-helpers/src/setup');
const { tracker } = balance;
const { expect } = require('chai');
const abi = require('ethereumjs-abi');
const utils = web3.utils;
const {
  ETH_TOKEN,
  USDT_TOKEN,
  WBTC_TOKEN,
  CURVE_TRICRYPTO_SWAP,
  CURVE_TRICRYPTO_DEPOSIT,
  CURVE_TRICRYPTOCRV,
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

const Proxy = artifacts.require('ProxyMock');
const Registry = artifacts.require('Registry');
const HCurve = artifacts.require('HCurve');
const ICurveHandler = artifacts.require('ICurveHandler');
const IToken = artifacts.require('IERC20');

contract('Curve Crypto', function([_, user]) {
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
    this.tricryptoSwap = await ICurveHandler.at(CURVE_TRICRYPTO_SWAP);
    this.tricryptoDeposit = await ICurveHandler.at(CURVE_TRICRYPTO_DEPOSIT);
  });

  beforeEach(async function() {
    id = await evmSnapshot();
  });

  afterEach(async function() {
    await evmRevert(id);
  });

  describe('Exchange', function() {
    describe('tricrypto pool', function() {
      const token0Address = USDT_TOKEN;
      const token1Address = WBTC_TOKEN;

      let token0, token1;
      let balanceUser, balanceProxy, token0User, token1User;
      let provider0Address;

      before(async function() {
        provider0Address = await tokenProviderUniV2(token0Address);

        token0 = await IToken.at(token0Address);
        token1 = await IToken.at(token1Address);
      });

      beforeEach(async function() {
        balanceUser = await tracker(user);
        balanceProxy = await tracker(this.proxy.address);
        token0User = await token0.balanceOf.call(user);
        token1User = await token1.balanceOf.call(user);
      });

      afterEach(async function() {
        // Check handler return
        expect(handlerReturn).to.be.bignumber.eq(answer);

        // Check proxy
        expect(await balanceProxy.get()).to.be.zero;
        expect(await token0.balanceOf.call(this.proxy.address)).to.be.zero;
        expect(await token1.balanceOf.call(this.proxy.address)).to.be.zero;

        profileGas(receipt);
      });

      it('Exact input swap USDT to WBTC by exchangeUint256Ether', async function() {
        const value = new BN('1000000');
        answer = await this.tricryptoSwap.methods[
          'get_dy(uint256,uint256,uint256)'
        ](0, 1, value);

        const data = abi.simpleEncode(
          'exchangeUint256Ether(address,address,address,uint256,uint256,uint256,uint256)',
          this.tricryptoSwap.address,
          token0.address,
          token1.address,
          0,
          1,
          value,
          mulPercent(answer, new BN('100').sub(slippage))
        );
        await token0.transfer(this.proxy.address, value, {
          from: provider0Address,
        });
        await this.proxy.updateTokenMock(token0.address);
        receipt = await this.proxy.execMock(this.hCurve.address, data, {
          from: user,
          value: ether('1'), // Ensure handler can correctly deal with ether
        });
        handlerReturn = utils.toBN(getHandlerReturn(receipt, ['uint256'])[0]);

        // Check user
        expect(await balanceUser.delta()).to.be.bignumber.eq(
          ether('0').sub(new BN(receipt.receipt.gasUsed))
        );
        expect(await token1.balanceOf.call(user)).to.be.bignumber.eq(
          handlerReturn.add(token1User)
        );
      });

      it('Exact input swap USDT to ETH by exchangeUint256Ether', async function() {
        const value = new BN('1000000');
        answer = await this.tricryptoSwap.methods[
          'get_dy(uint256,uint256,uint256)'
        ](0, 2, value);

        const data = abi.simpleEncode(
          'exchangeUint256Ether(address,address,address,uint256,uint256,uint256,uint256)',
          this.tricryptoSwap.address,
          token0.address,
          ETH_TOKEN,
          0,
          2,
          value,
          mulPercent(answer, new BN('100').sub(slippage))
        );
        await token0.transfer(this.proxy.address, value, {
          from: provider0Address,
        });
        await this.proxy.updateTokenMock(token0.address);
        receipt = await this.proxy.execMock(this.hCurve.address, data, {
          from: user,
          value: 0,
        });
        handlerReturn = utils.toBN(getHandlerReturn(receipt, ['uint256'])[0]);

        // Check user
        expect(await balanceUser.delta()).to.be.bignumber.eq(
          ether('0')
            .add(handlerReturn)
            .sub(new BN(receipt.receipt.gasUsed))
        );
      });

      it('Exact input swap ETH to WBTC by exchangeUint256Ether', async function() {
        const value = ether('1');
        answer = await this.tricryptoSwap.methods[
          'get_dy(uint256,uint256,uint256)'
        ](2, 1, value);

        const data = abi.simpleEncode(
          'exchangeUint256Ether(address,address,address,uint256,uint256,uint256,uint256)',
          this.tricryptoSwap.address,
          ETH_TOKEN,
          token1.address,
          2,
          1,
          value,
          mulPercent(answer, new BN('100').sub(slippage))
        );
        receipt = await this.proxy.execMock(this.hCurve.address, data, {
          from: user,
          value: value,
        });
        handlerReturn = utils.toBN(getHandlerReturn(receipt, ['uint256'])[0]);

        // Check user
        expect(await balanceUser.delta()).to.be.bignumber.eq(
          ether('0')
            .sub(value)
            .sub(new BN(receipt.receipt.gasUsed))
        );
        expect(await token1.balanceOf.call(user)).to.be.bignumber.eq(
          handlerReturn.add(token1User)
        );
      });
    });
  });

  describe('Liquidity with deposit contract', function() {
    describe('tricrypto pool', function() {
      const token0Address = USDT_TOKEN;
      const token1Address = WBTC_TOKEN;
      const poolTokenAddress = CURVE_TRICRYPTOCRV;

      let token0, token1, poolToken;
      let balanceUser, balanceProxy, token0User, token1User, poolTokenUser;
      let provider0Address;
      let provider1Address;
      let poolTokenProvider;

      before(async function() {
        provider0Address = await tokenProviderUniV2(token0Address);
        provider1Address = await tokenProviderUniV2(token1Address);
        poolTokenProvider = await tokenProviderCurveGauge(poolTokenAddress);

        token0 = await IToken.at(token0Address);
        token1 = await IToken.at(token1Address);
        poolToken = await IToken.at(poolTokenAddress);
      });

      beforeEach(async function() {
        balanceUser = await tracker(user);
        balanceProxy = await tracker(this.proxy.address);
        token0User = await token0.balanceOf.call(user);
        token1User = await token1.balanceOf.call(user);
        poolTokenUser = await poolToken.balanceOf.call(user);
      });

      afterEach(async function() {
        // Check handler return
        expect(handlerReturn).to.be.bignumber.gte(mulPercent(answer, 99));
        expect(handlerReturn).to.be.bignumber.lte(mulPercent(answer, 101));

        // Check proxy
        expect(await balanceProxy.get()).to.be.zero;
        expect(await token0.balanceOf.call(this.proxy.address)).to.be.zero;
        expect(await token1.balanceOf.call(this.proxy.address)).to.be.zero;
        expect(await poolToken.balanceOf.call(this.proxy.address)).to.be.zero;

        profileGas(receipt);
      });

      it('add USDT, WBTC and ETH to pool by addLiquidity', async function() {
        const token0Amount = new BN('1000000000'); // 1e9
        const token1Amount = new BN('10000000'); // 1e7
        const value = ether('1');
        const tokens = [token0.address, token1.address, ETH_TOKEN];
        const amounts = [token0Amount, token1Amount, value];

        // Get expected answer
        answer = await this.tricryptoSwap.methods[
          'calc_token_amount(uint256[3],bool)'
        ](amounts, true);

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
          'addLiquidity(address,address,address[],uint256[],uint256)',
          this.tricryptoDeposit.address,
          poolToken.address,
          tokens,
          amounts,
          minMintAmount
        );
        receipt = await this.proxy.execMock(this.hCurve.address, data, {
          from: user,
          value: value,
        });
        handlerReturn = utils.toBN(getHandlerReturn(receipt, ['uint256'])[0]);

        // Check user
        expect(await balanceUser.delta()).to.be.bignumber.eq(
          ether('0')
            .sub(value)
            .sub(new BN(receipt.receipt.gasUsed))
        );
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

      it('add USDT, WBTC and ETH to pool by addLiquidity with max amount', async function() {
        const token0Amount = new BN('1000000000'); // 1e9
        const token1Amount = new BN('10000000'); // 1e7
        const value = ether('1');
        const tokens = [token0.address, token1.address, ETH_TOKEN];
        const amounts = [token0Amount, token1Amount, value];

        // Get expected answer
        answer = await this.tricryptoSwap.methods[
          'calc_token_amount(uint256[3],bool)'
        ](amounts, true);

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
          'addLiquidity(address,address,address[],uint256[],uint256)',
          this.tricryptoDeposit.address,
          poolToken.address,
          tokens,
          [MAX_UINT256, MAX_UINT256, MAX_UINT256],
          minMintAmount
        );
        receipt = await this.proxy.execMock(this.hCurve.address, data, {
          from: user,
          value: value,
        });
        handlerReturn = utils.toBN(getHandlerReturn(receipt, ['uint256'])[0]);

        // Check user
        expect(await balanceUser.delta()).to.be.bignumber.eq(
          ether('0')
            .sub(value)
            .sub(new BN(receipt.receipt.gasUsed))
        );
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

      it('remove from pool to USDT by removeLiquidityOneCoinUint256', async function() {
        const amount = ether('0.1');
        answer = await this.tricryptoSwap.methods[
          'calc_withdraw_one_coin(uint256,uint256)'
        ](amount, 0);
        await poolToken.transfer(this.proxy.address, amount, {
          from: poolTokenProvider,
        });
        await this.proxy.updateTokenMock(poolToken.address);
        const minAmount = mulPercent(answer, new BN('100').sub(slippage));
        const data = abi.simpleEncode(
          'removeLiquidityOneCoinUint256(address,address,address,uint256,uint256,uint256)',
          this.tricryptoDeposit.address,
          poolToken.address,
          token0.address,
          amount,
          0,
          minAmount
        );
        receipt = await this.proxy.execMock(this.hCurve.address, data, {
          from: user,
          value: ether('1'),
        });
        handlerReturn = utils.toBN(getHandlerReturn(receipt, ['uint256'])[0]);

        // Check user
        expect(await token0.balanceOf.call(user)).to.be.bignumber.eq(
          handlerReturn.add(token0User)
        );
      });

      it('remove from pool to ETH by removeLiquidityOneCoinUint256', async function() {
        const amount = ether('0.1');
        answer = await this.tricryptoSwap.methods[
          'calc_withdraw_one_coin(uint256,uint256)'
        ](amount, 2);
        await poolToken.transfer(this.proxy.address, amount, {
          from: poolTokenProvider,
        });
        await this.proxy.updateTokenMock(poolToken.address);
        const minAmount = mulPercent(answer, new BN('100').sub(slippage));
        const data = abi.simpleEncode(
          'removeLiquidityOneCoinUint256(address,address,address,uint256,uint256,uint256)',
          this.tricryptoDeposit.address,
          poolToken.address,
          ETH_TOKEN,
          amount,
          2,
          minAmount
        );
        receipt = await this.proxy.execMock(this.hCurve.address, data, {
          from: user,
          value: 0,
        });
        handlerReturn = utils.toBN(getHandlerReturn(receipt, ['uint256'])[0]);

        // Check user
        expect(await balanceUser.delta()).to.be.bignumber.eq(
          ether('0')
            .add(handlerReturn)
            .sub(new BN(receipt.receipt.gasUsed))
        );
      });
    });
  });
});
