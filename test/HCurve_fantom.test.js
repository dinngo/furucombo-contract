if (network.config.chainId == 250) {
  // This test supports to run on these chains.
} else {
  return;
}

const { balance, BN, ether, constants } = require('@openzeppelin/test-helpers');
const { web3 } = require('@openzeppelin/test-helpers/src/setup');
const { MAX_UINT256 } = constants;
const { expect } = require('chai');
const abi = require('ethereumjs-abi');
const utils = web3.utils;
const {
  DAI_TOKEN,
  USDT_TOKEN,
  USDC_TOKEN,
  WETH_TOKEN,
  MIMATIC_TOKEN,
  CURVE_GEIST_SWAP,
  CURVE_FUSDT_SWAP,
  CURVE_2POOL_SWAP,
  CURVE_MAI3POOL_SWAP,
  CURVE_TRICRYPTO_SWAP,
  CURVE_2POOLCRV,
  CURVE_GEISTCRV,
  CURVE_FUSDTCRV,
  CURVE_TRICRYPTOCRV,
  CURVE_GEIST_GAUGE,
  CURVE_TRICRYPTO_GAUGE,
  CURVE_FUSDT_DEPOSIT,
} = require('./utils/constants');
const {
  mwei,
  evmRevert,
  evmSnapshot,
  mulPercent,
  profileGas,
  getHandlerReturn,
  getTokenProvider,
  tokenProviderCurveGauge,
  impersonateAndInjectEther,
} = require('./utils/utils');

const FeeRuleRegistry = artifacts.require('FeeRuleRegistry');
const Proxy = artifacts.require('ProxyMock');
const Registry = artifacts.require('Registry');
const HCurve = artifacts.require('HCurve');
const ICurveHandler = artifacts.require('ICurveHandler');
const IToken = artifacts.require('IERC20');

contract('Curve_fantom', function ([_, user]) {
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
    this.fUSDTSwap = await ICurveHandler.at(CURVE_FUSDT_SWAP);
    this.geistSwap = await ICurveHandler.at(CURVE_GEIST_SWAP);
    this.fUSDTDeposit = await ICurveHandler.at(CURVE_FUSDT_DEPOSIT);
    this.twoSwap = await ICurveHandler.at(CURVE_2POOL_SWAP);
    this.tricryptoSwap = await ICurveHandler.at(CURVE_TRICRYPTO_SWAP);
    this.mai3PoolSwap = await ICurveHandler.at(CURVE_MAI3POOL_SWAP);
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
      token0User = await this.token0.balanceOf.call(user);
      token1User = await this.token1.balanceOf.call(user);
    });

    describe('fUSDT pool', function () {
      it('Exact input swap USDT to DAI by exchangeUnderlying', async function () {
        const value = new BN('1000000');
        const answer = await this.fUSDTSwap.methods[
          'get_dy_underlying(int128,int128,uint256)'
        ](0, 1, value);
        const minAmount = mulPercent(answer, new BN('100').sub(slippage));

        const data = abi.simpleEncode(
          'exchangeUnderlying(address,address,address,int128,int128,uint256,uint256)',
          this.fUSDTSwap.address,
          this.token0.address,
          this.token1.address,
          0,
          1,
          value,
          minAmount
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

        expect(token1UserEnd).to.be.bignumber.gte(token1User.add(minAmount));
        profileGas(receipt);
      });

      it('Exact input swap USDT to DAI by exchangeUnderlying with max amount', async function () {
        const value = new BN('1000000');
        const answer = await this.fUSDTSwap.methods[
          'get_dy_underlying(int128,int128,uint256)'
        ](0, 1, value);
        const minAmount = mulPercent(answer, new BN('100').sub(slippage));

        const data = abi.simpleEncode(
          'exchangeUnderlying(address,address,address,int128,int128,uint256,uint256)',
          this.fUSDTSwap.address,
          this.token0.address,
          this.token1.address,
          0,
          1,
          MAX_UINT256,
          minAmount
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

        expect(token1UserEnd).to.be.bignumber.gte(token1User.add(minAmount));
        profileGas(receipt);
      });
    });

    describe('Geist pool', function () {
      it('Exact input swap USDT to DAI by exchangeUnderlying', async function () {
        const value = new BN('1000000');
        const answer = await this.geistSwap.methods[
          'get_dy_underlying(int128,int128,uint256)'
        ](2, 0, value);
        const minAmount = mulPercent(answer, new BN('100').sub(slippage));

        const data = abi.simpleEncode(
          'exchangeUnderlying(address,address,address,int128,int128,uint256,uint256)',
          this.geistSwap.address,
          this.token0.address,
          this.token1.address,
          2,
          0,
          value,
          minAmount
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

        expect(token1UserEnd).to.be.bignumber.gte(token1User.add(minAmount));
        profileGas(receipt);
      });

      it('Exact input swap USDT to DAI by exchangeUnderlying with max amount', async function () {
        const value = new BN('1000000');
        const answer = await this.geistSwap.methods[
          'get_dy_underlying(int128,int128,uint256)'
        ](2, 0, value);
        const minAmount = mulPercent(answer, new BN('100').sub(slippage));

        const data = abi.simpleEncode(
          'exchangeUnderlying(address,address,address,int128,int128,uint256,uint256)',
          this.geistSwap.address,
          this.token0.address,
          this.token1.address,
          2,
          0,
          MAX_UINT256,
          minAmount
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

        expect(token1UserEnd).to.be.bignumber.gte(token1User.add(minAmount));
        profileGas(receipt);
      });
    });
  });

  describe('Exchange', function () {
    describe('2pool', function () {
      const token0Address = DAI_TOKEN;
      const token1Address = USDC_TOKEN;

      let token0User;
      let token1User;
      let providerAddress;

      before(async function () {
        providerAddress = await getTokenProvider(token0Address);
        this.token0 = await IToken.at(token0Address);
        this.token1 = await IToken.at(token1Address);
      });

      beforeEach(async function () {
        token0User = await this.token0.balanceOf.call(user);
        token1User = await this.token1.balanceOf.call(user);
      });

      it('Exact input swap DAI to USDC by exchange', async function () {
        const value = ether('1');
        const answer = await this.twoSwap.methods[
          'get_dy(int128,int128,uint256)'
        ](0, 1, value);

        const data = abi.simpleEncode(
          'exchange(address,address,address,int128,int128,uint256,uint256)',
          this.twoSwap.address,
          this.token0.address,
          this.token1.address,
          0,
          1,
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
        // so give 1 wei tolerance for DAI/USDC case.
        expect(await this.token1.balanceOf.call(user)).to.be.bignumber.gte(
          token1User.add(answer).sub(new BN('1'))
        );
        expect(await this.token1.balanceOf.call(user)).to.be.bignumber.lte(
          token1User.add(answer)
        );
        profileGas(receipt);
      });

      it('Exact input swap DAI to USDC by exchange with max amount', async function () {
        const value = ether('1');
        const answer = await this.twoSwap.methods[
          'get_dy(int128,int128,uint256)'
        ](0, 1, value);
        const data = abi.simpleEncode(
          'exchange(address,address,address,int128,int128,uint256,uint256)',
          this.twoSwap.address,
          this.token0.address,
          this.token1.address,
          0,
          1,
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
        // so give 1 wei tolerance for DAI/USDC case.
        expect(await this.token1.balanceOf.call(user)).to.be.bignumber.gte(
          token1User.add(answer).sub(new BN('1'))
        );
        expect(await this.token1.balanceOf.call(user)).to.be.bignumber.lte(
          token1User.add(answer)
        );
        profileGas(receipt);
      });
    });

    describe('mai 3pool', function () {
      const token0Address = USDT_TOKEN;
      const token1Address = MIMATIC_TOKEN;

      let token0User;
      let token1User;
      let providerAddress;

      before(async function () {
        providerAddress = await getTokenProvider(token0Address);
        this.token0 = await IToken.at(token0Address);
        this.token1 = await IToken.at(token1Address);
      });

      beforeEach(async function () {
        token0User = await this.token0.balanceOf.call(user);
        token1User = await this.token1.balanceOf.call(user);
      });

      it('Exact input swap DAI to miMATIC by exchange', async function () {
        const value = mwei('100');
        const answer = await this.mai3PoolSwap.methods[
          'get_dy(int128,int128,uint256)'
        ](1, 0, value);

        const data = abi.simpleEncode(
          'exchange(address,address,address,int128,int128,uint256,uint256)',
          this.mai3PoolSwap.address,
          this.token0.address,
          this.token1.address,
          1,
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
        // get_dy flow is different from exchange,
        // so give 1 wei tolerance for DAI/miMATIC case.
        expect(await this.token1.balanceOf.call(user)).to.be.bignumber.gte(
          token1User.add(answer).sub(new BN('1'))
        );
        expect(await this.token1.balanceOf.call(user)).to.be.bignumber.lte(
          token1User.add(answer)
        );
        profileGas(receipt);
      });

      it('Exact input swap DAI to miMATIC by exchange with max amount', async function () {
        const value = mwei('100');
        const answer = await this.mai3PoolSwap.methods[
          'get_dy(int128,int128,uint256)'
        ](1, 0, value);
        const data = abi.simpleEncode(
          'exchange(address,address,address,int128,int128,uint256,uint256)',
          this.mai3PoolSwap.address,
          this.token0.address,
          this.token1.address,
          1,
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
        // get_dy flow is different from exchange,
        // so give 1 wei tolerance for DAI/miMATIC case.
        expect(await this.token1.balanceOf.call(user)).to.be.bignumber.gte(
          token1User.add(answer).sub(new BN('1'))
        );
        expect(await this.token1.balanceOf.call(user)).to.be.bignumber.lte(
          token1User.add(answer)
        );
        profileGas(receipt);
      });
    });

    describe('tricrypto', function () {
      const token0Address = USDT_TOKEN;
      const token1Address = WETH_TOKEN;

      let token0User;
      let token1User;
      let providerAddress;

      before(async function () {
        providerAddress = await getTokenProvider(token0Address);
        this.token0 = await IToken.at(token0Address);
        this.token1 = await IToken.at(token1Address);
      });

      beforeEach(async function () {
        token0User = await this.token0.balanceOf.call(user);
        token1User = await this.token1.balanceOf.call(user);
      });

      it('Exact input swap USDT to WETH by exchange', async function () {
        const value = mwei('100');
        const answer = await this.tricryptoSwap.methods[
          'get_dy(uint256,uint256,uint256)'
        ](0, 2, value);

        const data = abi.simpleEncode(
          'exchangeUint256(address,address,address,uint256,uint256,uint256,uint256)',
          this.tricryptoSwap.address,
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
        // so give 1 wei tolerance for USDT/WETH case.
        expect(await this.token1.balanceOf.call(user)).to.be.bignumber.gte(
          token1User.add(answer).sub(new BN('1'))
        );
        expect(await this.token1.balanceOf.call(user)).to.be.bignumber.lte(
          token1User.add(answer)
        );
        profileGas(receipt);
      });

      it('Exact input swap USDT to WETH by exchange with max amount', async function () {
        const value = mwei('100');
        const answer = await this.tricryptoSwap.methods[
          'get_dy(uint256,uint256,uint256)'
        ](0, 2, value);
        const data = abi.simpleEncode(
          'exchangeUint256(address,address,address,uint256,uint256,uint256,uint256)',
          this.tricryptoSwap.address,
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
        // so give 1 wei tolerance for USDT/WETH case.
        expect(await this.token1.balanceOf.call(user)).to.be.bignumber.gte(
          token1User.add(answer).sub(new BN('1'))
        );
        expect(await this.token1.balanceOf.call(user)).to.be.bignumber.lte(
          token1User.add(answer)
        );
        profileGas(receipt);
      });
    });
  });

  describe('Liquidity', function () {
    describe('2pool', function () {
      const token0Address = DAI_TOKEN;
      const token1Address = USDC_TOKEN;
      const poolTokenAddress = CURVE_2POOLCRV;

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
        token0User = await this.token0.balanceOf.call(user);
        token1User = await this.token1.balanceOf.call(user);
        poolTokenUser = await this.poolToken.balanceOf.call(user);
      });

      it('add DAI and USDC to pool by addLiquidity', async function () {
        const token0Amount = ether('1');
        const token1Amount = new BN('2000000');
        const tokens = [this.token0.address, this.token1.address];
        const amounts = [token0Amount, token1Amount];

        // Get expected answer
        const answer = await this.twoSwap.methods[
          'calc_token_amount(uint256[2],bool)'
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
          this.twoSwap.address,
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

      it('add DAI and USDC to pool by addLiquidity with max amount', async function () {
        const token0Amount = ether('1');
        const token1Amount = new BN('2000000');
        const tokens = [this.token0.address, this.token1.address];
        const amounts = [token0Amount, token1Amount];

        // Get expected answer
        const answer = await this.twoSwap.methods[
          'calc_token_amount(uint256[2],bool)'
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
          this.twoSwap.address,
          this.poolToken.address,
          tokens,
          [MAX_UINT256, MAX_UINT256],
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

      it('remove from pool to USDC by removeLiquidityOneCoin', async function () {
        const poolTokenUser = ether('0.1');
        const token1UserBefore = await this.token1.balanceOf.call(user);
        const answer = await this.twoSwap.methods[
          'calc_withdraw_one_coin(uint256,int128)'
        ](poolTokenUser, 1);
        await this.poolToken.transfer(this.proxy.address, poolTokenUser, {
          from: poolTokenProvider,
        });
        await this.proxy.updateTokenMock(this.poolToken.address);
        const minAmount = mulPercent(answer, new BN('100').sub(slippage));
        const data = abi.simpleEncode(
          'removeLiquidityOneCoin(address,address,address,uint256,int128,uint256)',
          this.twoSwap.address,
          this.poolToken.address,
          this.token1.address,
          poolTokenUser,
          1,
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

      it('remove from pool to USDC by removeLiquidityOneCoin with max amount', async function () {
        const poolTokenUser = ether('0.1');
        const token1UserBefore = await this.token1.balanceOf.call(user);
        const answer = await this.twoSwap.methods[
          'calc_withdraw_one_coin(uint256,int128)'
        ](poolTokenUser, 1);
        await this.poolToken.transfer(this.proxy.address, poolTokenUser, {
          from: poolTokenProvider,
        });
        await this.proxy.updateTokenMock(this.poolToken.address);
        const minAmount = mulPercent(answer, new BN('100').sub(slippage));
        const data = abi.simpleEncode(
          'removeLiquidityOneCoin(address,address,address,uint256,int128,uint256)',
          this.twoSwap.address,
          this.poolToken.address,
          this.token1.address,
          MAX_UINT256,
          1,
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

    describe('tricrypto', function () {
      const token0Address = USDT_TOKEN;
      const token1Address = WETH_TOKEN;
      const poolTokenAddress = CURVE_TRICRYPTOCRV;
      const poolTokenProvider = CURVE_TRICRYPTO_GAUGE;

      let token0User;
      let token1User;
      let provider0Address;
      let provider1Address;

      before(async function () {
        provider0Address = await getTokenProvider(token0Address);
        provider1Address = await getTokenProvider(token1Address);

        // Registry doesn't register the crv pool, just using gauge as provider
        await impersonateAndInjectEther(poolTokenProvider);

        this.token0 = await IToken.at(token0Address);
        this.token1 = await IToken.at(token1Address);
        this.poolToken = await IToken.at(poolTokenAddress);
      });

      beforeEach(async function () {
        token0User = await this.token0.balanceOf.call(user);
        token1User = await this.token1.balanceOf.call(user);
        poolTokenUser = await this.poolToken.balanceOf.call(user);
      });

      it('add USDT and WETH to pool by addLiquidity', async function () {
        const token0Amount = new BN('2000000');
        const token1Amount = ether('1');
        const tokens = [
          this.token0.address,
          constants.ZERO_ADDRESS,
          this.token1.address,
        ];
        const amounts = [token0Amount, 0, token1Amount];

        // Get expected answer
        const answer = await this.tricryptoSwap.methods[
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
          this.tricryptoSwap.address,
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

      it('add USDT and WETH to pool by addLiquidity with max amount', async function () {
        const token0Amount = new BN('2000000');
        const token1Amount = ether('1');
        const tokens = [
          this.token0.address,
          constants.ZERO_ADDRESS,
          this.token1.address,
        ];
        const amounts = [token0Amount, 0, token1Amount];

        // Get expected answer
        const answer = await this.tricryptoSwap.methods[
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
          this.tricryptoSwap.address,
          this.poolToken.address,
          tokens,
          [constants.MAX_UINT256, 0, constants.MAX_UINT256],
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

      it('remove from pool to WETH by removeLiquidityOneCoin', async function () {
        const poolTokenUser = ether('0.1');
        const token1UserBefore = await this.token1.balanceOf.call(user);
        const answer = await this.tricryptoSwap.methods[
          'calc_withdraw_one_coin(uint256,uint256)'
        ](poolTokenUser, 2);

        await this.poolToken.transfer(this.proxy.address, poolTokenUser, {
          from: poolTokenProvider,
        });
        await this.proxy.updateTokenMock(this.poolToken.address);

        const minAmount = mulPercent(answer, new BN('100').sub(slippage));
        const data = abi.simpleEncode(
          'removeLiquidityOneCoinUint256(address,address,address,uint256,uint256,uint256)',
          this.tricryptoSwap.address,
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

      it('remove from pool to WETH by removeLiquidityOneCoin with max amount', async function () {
        const poolTokenUser = ether('0.1');
        const token1UserBefore = await this.token1.balanceOf.call(user);
        const answer = await this.tricryptoSwap.methods[
          'calc_withdraw_one_coin(uint256,uint256)'
        ](poolTokenUser, 2);
        await this.poolToken.transfer(this.proxy.address, poolTokenUser, {
          from: poolTokenProvider,
        });
        await this.proxy.updateTokenMock(this.poolToken.address);
        const minAmount = mulPercent(answer, new BN('100').sub(slippage));
        const data = abi.simpleEncode(
          'removeLiquidityOneCoinUint256(address,address,address,uint256,uint256,uint256)',
          this.tricryptoSwap.address,
          this.poolToken.address,
          this.token1.address,
          MAX_UINT256,
          2,
          minAmount
        );
        const receipt = await this.proxy.execMock(this.hCurve.address, data, {
          from: user,
          value: ether('2'),
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

    describe('geist pool', function () {
      const token0Address = DAI_TOKEN;
      const token1Address = USDC_TOKEN;
      const poolTokenAddress = CURVE_GEISTCRV;
      const poolTokenProvider = CURVE_GEIST_GAUGE;

      let token0User;
      let token1User;
      let provider0Address;
      let provider1Address;

      before(async function () {
        provider0Address = await getTokenProvider(token0Address);
        provider1Address = await getTokenProvider(token1Address);

        // Registry doesn't register the crv pool, just using gauge as provider
        await impersonateAndInjectEther(poolTokenProvider);

        this.token0 = await IToken.at(token0Address);
        this.token1 = await IToken.at(token1Address);
        this.poolToken = await IToken.at(poolTokenAddress);
      });

      beforeEach(async function () {
        token0User = await this.token0.balanceOf.call(user);
        token1User = await this.token1.balanceOf.call(user);
        poolTokenUser = await this.poolToken.balanceOf.call(user);
      });

      it('add DAI and USDC to pool by addLiquidityUnderlying', async function () {
        const token0Amount = ether('1');
        const token1Amount = new BN('2000000');
        const tokens = [
          this.token0.address,
          this.token1.address,
          constants.ZERO_ADDRESS,
        ];
        const amounts = [token0Amount, token1Amount, 0];

        // Get expected answer
        const answer = await this.geistSwap.methods[
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
          this.geistSwap.address,
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

      it('add DAI and USDC to pool by addLiquidityUnderlying with max amount', async function () {
        const token0Amount = ether('1');
        const token1Amount = new BN('2000000');
        const tokens = [
          this.token0.address,
          this.token1.address,
          constants.ZERO_ADDRESS,
        ];
        const amounts = [token0Amount, token1Amount, 0];

        // Get expected answer
        const answer = await this.geistSwap.methods[
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
          this.geistSwap.address,
          this.poolToken.address,
          tokens,
          [MAX_UINT256, MAX_UINT256, 0],
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

      it('remove from pool to USDC by removeLiquidityOneCoinUnderlying', async function () {
        const poolTokenUser = ether('0.1');
        const token1UserBefore = await this.token1.balanceOf.call(user);
        const answer = await this.geistSwap.methods[
          'calc_withdraw_one_coin(uint256,int128)'
        ](poolTokenUser, 1);
        await this.poolToken.transfer(this.proxy.address, poolTokenUser, {
          from: poolTokenProvider,
        });
        await this.proxy.updateTokenMock(this.poolToken.address);
        const minAmount = mulPercent(answer, new BN('100').sub(slippage));
        const data = abi.simpleEncode(
          'removeLiquidityOneCoinUnderlying(address,address,address,uint256,int128,uint256)',
          this.geistSwap.address,
          this.poolToken.address,
          this.token1.address,
          poolTokenUser,
          1,
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

      it('remove from pool to USDC by removeLiquidityOneCoinUnderlying with max amount', async function () {
        const poolTokenUser = ether('0.1');
        const token1UserBefore = await this.token1.balanceOf.call(user);
        const answer = await this.geistSwap.methods[
          'calc_withdraw_one_coin(uint256,int128)'
        ](poolTokenUser, 1);

        await this.poolToken.transfer(this.proxy.address, poolTokenUser, {
          from: poolTokenProvider,
        });
        await this.proxy.updateTokenMock(this.poolToken.address);
        const minAmount = mulPercent(answer, new BN('100').sub(slippage));
        const data = abi.simpleEncode(
          'removeLiquidityOneCoinUnderlying(address,address,address,uint256,int128,uint256)',
          this.geistSwap.address,
          this.poolToken.address,
          this.token1.address,
          MAX_UINT256,
          1,
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
  });

  describe('Liquidity with deposit contract', function () {
    describe('fUSDT pool', function () {
      const token0Address = DAI_TOKEN;
      const token1Address = USDC_TOKEN;
      const poolTokenAddress = CURVE_FUSDTCRV;

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
        token0User = await this.token0.balanceOf.call(user);
        token1User = await this.token1.balanceOf.call(user);
        poolTokenUser = await this.poolToken.balanceOf.call(user);
      });

      it('add DAI and USDC to pool by addLiquidity', async function () {
        const token0Amount = ether('1000');
        const token1Amount = new BN('1000000000');
        // Get expected answer
        const answer = await this.fUSDTDeposit.methods[
          'calc_token_amount(uint256[3],bool)'
        ](
          [
            0,
            token0Amount, // DAI
            token1Amount, // USDC
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
          constants.ZERO_ADDRESS,
          this.token0.address,
          this.token1.address,
        ];
        const amounts = [0, token0Amount, token1Amount];
        const minMintAmount = mulPercent(answer, new BN('100').sub(slippage));
        const data = abi.simpleEncode(
          'addLiquidity(address,address,address[],uint256[],uint256)',
          this.fUSDTDeposit.address,
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

        expect(await this.poolToken.balanceOf.call(user)).to.be.bignumber.gte(
          mulPercent(answer, 90)
        );
        profileGas(receipt);
      });

      it('add DAI and USDC to pool by addLiquidity with max amount', async function () {
        const token0Amount = ether('1000');
        const token1Amount = new BN('1000000000');
        // Get expected answer
        const answer = await this.fUSDTDeposit.methods[
          'calc_token_amount(uint256[3],bool)'
        ](
          [
            0,
            token0Amount, // DAI
            token1Amount, // USDC
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
          constants.ZERO_ADDRESS,
          this.token0.address,
          this.token1.address,
        ];
        const amounts = [0, token0Amount, token1Amount];
        const minMintAmount = mulPercent(answer, new BN('100').sub(slippage));
        const data = abi.simpleEncode(
          'addLiquidity(address,address,address[],uint256[],uint256)',
          this.fUSDTDeposit.address,
          this.poolToken.address,
          tokens,
          [0, constants.MAX_UINT256, constants.MAX_UINT256],
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

        expect(await this.poolToken.balanceOf.call(user)).to.be.bignumber.gte(
          mulPercent(answer, 90)
        );
        profileGas(receipt);
      });

      it('remove from pool to USDC by removeLiquidityOneCoin', async function () {
        const token1UserBefore = await this.token1.balanceOf.call(user);
        const poolTokenUser = ether('1');
        const answer = await this.fUSDTDeposit.methods[
          'calc_withdraw_one_coin(uint256,int128)'
        ](poolTokenUser, 2);

        await this.poolToken.transfer(this.proxy.address, poolTokenUser, {
          from: poolTokenProvider,
        });

        await this.proxy.updateTokenMock(this.poolToken.address);
        const minAmount = mulPercent(answer, new BN('100').sub(slippage));
        const data = abi.simpleEncode(
          'removeLiquidityOneCoin(address,address,address,uint256,int128,uint256)',
          this.fUSDTDeposit.address,
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
