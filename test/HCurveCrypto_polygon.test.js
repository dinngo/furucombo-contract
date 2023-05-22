if (network.config.chainId == 137) {
  // This test supports to run on these chains.

  // Due to Aave governance 224 issue, skip temporary
  return;
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
  WETH_TOKEN,
  USDT_TOKEN,
  WBTC_TOKEN,
  CURVE_ATRICRYPTO_DEPOSIT,
  CURVE_ATRICRYPTOCRV,
  CURVE_ATRICRYPTOCRV_PROVIDER,
} = require('./utils/constants');
const {
  evmRevert,
  evmSnapshot,
  mulPercent,
  profileGas,
  getHandlerReturn,
  getTokenProvider,
} = require('./utils/utils');

const Proxy = artifacts.require('ProxyMock');
const Registry = artifacts.require('Registry');
const FeeRuleRegistry = artifacts.require('FeeRuleRegistry');
const HCurve = artifacts.require('HCurve');
const ICurveHandler = artifacts.require('ICurveHandler');
const IToken = artifacts.require('IERC20');

contract('Curve Crypto', function ([_, user]) {
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
    this.atricryptoDeposit = await ICurveHandler.at(CURVE_ATRICRYPTO_DEPOSIT);

    // FIXME: static provider beacuse curve address provider hasn't atricrypto pool
    await network.provider.request({
      method: 'hardhat_impersonateAccount',
      params: [CURVE_ATRICRYPTOCRV_PROVIDER],
    });
  });

  beforeEach(async function () {
    id = await evmSnapshot();
  });

  afterEach(async function () {
    await evmRevert(id);
  });

  describe('Exchange underlying', function () {
    describe('atricrypto pool', function () {
      const token0Address = USDT_TOKEN;
      const token1Address = WBTC_TOKEN;
      const token2Address = WETH_TOKEN;

      let token0, token1, token2;
      let balanceUser, balanceProxy, token0User, token1User, token2User;
      let provider0Address, provider1Address;

      before(async function () {
        provider0Address = await getTokenProvider(token0Address);
        provider1Address = await getTokenProvider(token1Address);

        token0 = await IToken.at(token0Address);
        token1 = await IToken.at(token1Address);
        token2 = await IToken.at(token2Address);
      });

      beforeEach(async function () {
        balanceUser = await tracker(user);
        balanceProxy = await tracker(this.proxy.address);
        token0User = await token0.balanceOf(user);
        token1User = await token1.balanceOf(user);
        token2User = await token2.balanceOf(user);
      });

      afterEach(async function () {
        // Check handler return
        expect(handlerReturn).to.be.bignumber.gte(mulPercent(answer, 99));
        expect(handlerReturn).to.be.bignumber.lte(mulPercent(answer, 101));

        // Check proxy
        expect(await balanceProxy.get()).to.be.bignumber.zero;
        expect(await token0.balanceOf(this.proxy.address)).to.be.bignumber.zero;
        expect(await token1.balanceOf(this.proxy.address)).to.be.bignumber.zero;
        expect(await token2.balanceOf(this.proxy.address)).to.be.bignumber.zero;

        profileGas(receipt);
      });

      it('Exact input swap USDT to WBTC by exchangeUnderlyingUint256', async function () {
        const value = new BN('100000000'); // 1e8
        answer = await this.atricryptoDeposit.methods[
          'get_dy_underlying(uint256,uint256,uint256)'
        ](2, 3, value);

        const data = abi.simpleEncode(
          'exchangeUnderlyingUint256(address,address,address,uint256,uint256,uint256,uint256)',
          this.atricryptoDeposit.address,
          token0.address,
          token1.address,
          2,
          3,
          value,
          mulPercent(answer, new BN('100').sub(slippage))
        );
        await token0.transfer(this.proxy.address, value, {
          from: provider0Address,
        });
        await this.proxy.updateTokenMock(token0.address);
        receipt = await this.proxy.execMock(this.hCurve.address, data, {
          from: user,
          value: ether('1'), // Ensure handler can correctly deal with matic
        });
        handlerReturn = utils.toBN(getHandlerReturn(receipt, ['uint256'])[0]);

        // Check user
        expect(await balanceUser.delta()).to.be.bignumber.eq(ether('0'));
        expect(await token1.balanceOf(user)).to.be.bignumber.eq(
          handlerReturn.add(token1User)
        );
      });

      it('Exact input swap WBTC to WETH by exchangeUnderlyingUint256', async function () {
        const value = new BN('1000000'); // 1e6
        answer = await this.atricryptoDeposit.methods[
          'get_dy_underlying(uint256,uint256,uint256)'
        ](3, 4, value);

        const data = abi.simpleEncode(
          'exchangeUnderlyingUint256(address,address,address,uint256,uint256,uint256,uint256)',
          this.atricryptoDeposit.address,
          token1.address,
          token2.address,
          3,
          4,
          value,
          mulPercent(answer, new BN('100').sub(slippage))
        );
        await token1.transfer(this.proxy.address, value, {
          from: provider1Address,
        });
        await this.proxy.updateTokenMock(token1.address);
        receipt = await this.proxy.execMock(this.hCurve.address, data, {
          from: user,
          value: ether('1'), // Ensure handler can correctly deal with matic
        });
        handlerReturn = utils.toBN(getHandlerReturn(receipt, ['uint256'])[0]);

        // Check user
        expect(await balanceUser.delta()).to.be.bignumber.eq(ether('0'));
        expect(await token2.balanceOf(user)).to.be.bignumber.eq(
          handlerReturn.add(token2User)
        );
      });
    });
  });

  describe('Liquidity', function () {
    describe('atricrypto pool', function () {
      const token0Address = USDT_TOKEN;
      const token1Address = WBTC_TOKEN;
      const token2Address = WETH_TOKEN;
      const poolTokenAddress = CURVE_ATRICRYPTOCRV;
      const poolTokenProvider = CURVE_ATRICRYPTOCRV_PROVIDER;

      let token0, token1, token2, poolToken;
      let balanceProxy, token0User, token1User, token2User, poolTokenUser;
      let provider0Address, provider1Address, provider2Address;

      before(async function () {
        provider0Address = await getTokenProvider(token0Address);
        provider1Address = await getTokenProvider(token1Address);
        provider2Address = await getTokenProvider(token2Address);

        token0 = await IToken.at(token0Address);
        token1 = await IToken.at(token1Address);
        token2 = await IToken.at(token2Address);
        poolToken = await IToken.at(poolTokenAddress);
      });

      beforeEach(async function () {
        balanceProxy = await tracker(this.proxy.address);
        token0User = await token0.balanceOf(user);
        token1User = await token1.balanceOf(user);
        token2User = await token2.balanceOf(user);
        poolTokenUser = await poolToken.balanceOf(user);
      });

      afterEach(async function () {
        // Check handler
        expect(handlerReturn).to.be.bignumber.gte(mulPercent(answer, 99));
        expect(handlerReturn).to.be.bignumber.lte(mulPercent(answer, 101));

        // Check proxy
        expect(await balanceProxy.get()).to.be.bignumber.zero;
        expect(await token0.balanceOf(this.proxy.address)).to.be.bignumber.zero;
        expect(await token1.balanceOf(this.proxy.address)).to.be.bignumber.zero;
        expect(await token2.balanceOf(this.proxy.address)).to.be.bignumber.zero;
        expect(
          await poolToken.balanceOf(this.proxy.address)
        ).to.be.bignumber.zero;

        profileGas(receipt);
      });

      var cases = [
        [[], ''], // will skip normal case
        [[0, 0, MAX_UINT256, MAX_UINT256, MAX_UINT256], ' max'],
      ];
      cases.forEach(function (params) {
        it(
          'add USDT, WBTC and WETH to pool by addLiquidity' + params[1],
          async function () {
            const token0Amount = new BN('100000000'); // 1e8
            const token1Amount = new BN('1000000'); // 1e6
            const token2Amount = ether('0.1');
            const tokens = [
              constants.ZERO_ADDRESS,
              constants.ZERO_ADDRESS,
              token0.address,
              token1.address,
              token2.address,
            ];
            const amounts = [
              new BN('0'),
              new BN('0'),
              token0Amount,
              token1Amount,
              token2Amount,
            ];

            // Get expected answer
            answer = await this.atricryptoDeposit.methods[
              'calc_token_amount(uint256[5],bool)'
            ](amounts, true);

            // Execute handler
            await token0.transfer(this.proxy.address, token0Amount, {
              from: provider0Address,
            });
            await token1.transfer(this.proxy.address, token1Amount, {
              from: provider1Address,
            });
            await token2.transfer(this.proxy.address, token2Amount, {
              from: provider2Address,
            });
            await this.proxy.updateTokenMock(token0.address);
            await this.proxy.updateTokenMock(token1.address);
            await this.proxy.updateTokenMock(token2.address);
            const param = params[0].length == 0 ? amounts : params[0];
            const minMintAmount = mulPercent(
              answer,
              new BN('100').sub(slippage)
            );
            const data = abi.simpleEncode(
              'addLiquidity(address,address,address[],uint256[],uint256)',
              this.atricryptoDeposit.address,
              poolToken.address,
              tokens,
              param,
              minMintAmount
            );
            receipt = await this.proxy.execMock(this.hCurve.address, data, {
              from: user,
              value: ether('1'), // Ensure handler can correctly deal with matic
            });
            handlerReturn = utils.toBN(
              getHandlerReturn(receipt, ['uint256'])[0]
            );

            // Check user
            expect(await token0.balanceOf(user)).to.be.bignumber.eq(token0User);
            expect(await token1.balanceOf(user)).to.be.bignumber.eq(token1User);
            expect(await token2.balanceOf(user)).to.be.bignumber.eq(token2User);
            expect(await poolToken.balanceOf(user)).to.be.bignumber.eq(
              handlerReturn.add(poolTokenUser)
            );
          }
        );
      });

      var cases = [
        [0, ''], // will skip normal case
        [MAX_UINT256, ' max'],
      ];
      cases.forEach(function (params) {
        it(
          'remove from pool to USDT by removeLiquidityOneCoinUint256' +
            params[1],
          async function () {
            const amount = ether('0.1');
            answer = await this.atricryptoDeposit.methods[
              'calc_withdraw_one_coin(uint256,uint256)'
            ](amount, 2);
            await poolToken.transfer(this.proxy.address, amount, {
              from: poolTokenProvider,
            });
            await this.proxy.updateTokenMock(poolToken.address);
            const param = params[0] == 0 ? amount : params[0];
            const minAmount = mulPercent(answer, new BN('100').sub(slippage));
            const data = abi.simpleEncode(
              'removeLiquidityOneCoinUint256(address,address,address,uint256,uint256,uint256)',
              this.atricryptoDeposit.address,
              poolToken.address,
              token0.address,
              param,
              2,
              minAmount
            );
            receipt = await this.proxy.execMock(this.hCurve.address, data, {
              from: user,
              value: ether('1'), // Ensure handler can correctly deal with matic
            });
            handlerReturn = utils.toBN(
              getHandlerReturn(receipt, ['uint256'])[0]
            );

            // Check user
            expect(await token0.balanceOf(user)).to.be.bignumber.eq(
              handlerReturn.add(token0User)
            );
          }
        );
      });

      it('remove from pool to WETH by removeLiquidityOneCoinUint256', async function () {
        const amount = ether('0.1');
        answer = await this.atricryptoDeposit.methods[
          'calc_withdraw_one_coin(uint256,uint256)'
        ](amount, 4);
        await poolToken.transfer(this.proxy.address, amount, {
          from: poolTokenProvider,
        });
        await this.proxy.updateTokenMock(poolToken.address);
        const minAmount = mulPercent(answer, new BN('100').sub(slippage));
        const data = abi.simpleEncode(
          'removeLiquidityOneCoinUint256(address,address,address,uint256,uint256,uint256)',
          this.atricryptoDeposit.address,
          poolToken.address,
          token2.address,
          amount,
          4,
          minAmount
        );
        receipt = await this.proxy.execMock(this.hCurve.address, data, {
          from: user,
          value: ether('1'), // Ensure handler can correctly deal with matic
        });
        handlerReturn = utils.toBN(getHandlerReturn(receipt, ['uint256'])[0]);

        // Check user
        expect(await token2.balanceOf(user)).to.be.bignumber.eq(
          handlerReturn.add(token2User)
        );
      });
    });
  });
});
