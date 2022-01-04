const {
  balance,
  BN,
  ether,
  expectRevert,
} = require('@openzeppelin/test-helpers');
const { tracker } = balance;
const utils = web3.utils;
const { expect } = require('chai');
const {
  DAI_TOKEN,
  USDC_TOKEN,
  WETH_TOKEN,
  NATIVE_TOKEN,
  NATIVE_TOKEN_DECIMAL,
} = require('./utils/constants');
const {
  evmRevert,
  evmSnapshot,
  mulPercent,
  profileGas,
  getHandlerReturn,
  getFuncSig,
  getCallData,
  tokenProviderYearn,
} = require('./utils/utils');
const fetch = require('node-fetch');
const queryString = require('query-string');

const HParaSwapV5 = artifacts.require('HParaSwapV5');
const Registry = artifacts.require('Registry');
const Proxy = artifacts.require('ProxyMock');
const IToken = artifacts.require('IERC20');
const IOneInch = artifacts.require('IAggregationRouterV3');

/// network id for different chain
const ETHEREUM_NETWORK_ID = 1;
const POLYGON_NETWORK_ID = 137;
const URL_PARASWAP = 'https://apiv5.paraswap.io/';
const IGNORE_CHECKS_PARAM = 'ignoreChecks=true';
const URL_PARASWAP_PRICE = URL_PARASWAP + 'prices';
const URL_PARASWAP_TRANSACTION =
  URL_PARASWAP +
  'transactions/' +
  ETHEREUM_NETWORK_ID +
  '?' +
  IGNORE_CHECKS_PARAM;

const DUMMY_ADDRESS = '0xa3C1C91403F0026b9dd086882aDbC8Cdbc3b3cfB';

async function getPriceData(
  srcToken,
  srcDecimals,
  destToken,
  destDecimals,
  amount
) {
  const priceReq = queryString.stringifyUrl({
    url: URL_PARASWAP_PRICE,
    query: {
      srcToken: srcToken,
      srcDecimals: srcDecimals,
      destToken: destToken,
      destDecimals: destDecimals,
      amount: amount,
      network: ETHEREUM_NETWORK_ID,
    },
  });

  // Call Paraswap price API
  const priceResponse = await fetch(priceReq);
  const priceData = await priceResponse.json();
  expect(
    priceResponse.ok,
    'Paraswap price api response not ok:' + priceData.error
  ).to.be.true;

  return priceData;
}

async function getTransactionData(priceData, slippage) {
  const body = {
    srcToken: priceData.priceRoute.srcToken,
    srcDecimals: priceData.priceRoute.srcDecimals,
    destToken: priceData.priceRoute.destToken,
    destDecimals: priceData.priceRoute.destDecimals,
    srcAmount: priceData.priceRoute.srcAmount,
    slippage: slippage,
    userAddress: DUMMY_ADDRESS,
    priceRoute: priceData.priceRoute,
  };

  const txResp = await fetch(URL_PARASWAP_TRANSACTION, {
    method: 'post',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
  const txData = await txResp.json();
  expect(txResp.ok, 'Paraswap transaction api response not ok: ' + txData.error)
    .to.be.true;
  return txData;
}

contract('ParaSwapV5', function([_, user]) {
  let id;
  let initialEvmId;
  before(async function() {
    initialEvmId = await evmSnapshot();

    this.registry = await Registry.new();
    this.hParaSwap = await HParaSwapV5.new();
    await this.registry.register(
      this.hParaSwap.address,
      utils.asciiToHex('ParaSwapV5')
    );
    this.proxy = await Proxy.new(this.registry.address);
  });

  beforeEach(async function() {
    id = await evmSnapshot();
    balanceUser = await tracker(user);
  });

  afterEach(async function() {
    await evmRevert(id);
  });
  after(async function() {
    await evmRevert(initialEvmId);
  });

  describe('Ether to Token', function() {
    const tokenAddress = DAI_TOKEN;
    const tokenDecimal = 18;
    const slippage = 100; // 1%
    const wrongTokenAddress = USDC_TOKEN;

    before(async function() {
      this.token = await IToken.at(tokenAddress);
    });

    beforeEach(async function() {
      userBalance = await tracker(user);
      proxyBalance = await tracker(this.proxy.address);
      userTokenBalance = await this.token.balanceOf.call(user);
      proxyTokenBalance = await this.token.balanceOf.call(this.proxy.address);
    });

    describe('Swap', function() {
      it('normal', async function() {
        // Get price
        const amount = ether('0.1');
        const to = this.hParaSwap.address;

        // Call Paraswap Price API
        const priceData = await getPriceData(
          NATIVE_TOKEN,
          NATIVE_TOKEN_DECIMAL,
          tokenAddress,
          tokenDecimal,
          amount
        );

        // Call Paraswap transaction API
        const txData = await getTransactionData(priceData, slippage);

        // Prepare handler data
        const callData = getCallData(HParaSwapV5, 'swap', [
          NATIVE_TOKEN,
          amount,
          tokenAddress,
          txData.data,
        ]);

        // Execute
        const receipt = await this.proxy.execMock(to, callData, {
          from: user,
          value: amount,
        });

        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );

        const userTokenBalanceAfter = await this.token.balanceOf.call(user);

        // verify user token balance
        expect(handlerReturn).to.be.bignumber.eq(
          userTokenBalanceAfter.sub(userTokenBalance)
        );

        // proxy should not have remaining token
        expect(
          await this.token.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.zero;

        // verify ether balance
        expect(await proxyBalance.get()).to.be.bignumber.zero;
        expect(await userBalance.delta()).to.be.bignumber.eq(
          ether('0')
            .sub(amount)
            .sub(new BN(receipt.receipt.gasUsed))
        );
      });

      it('msg.value greater than input ether amount', async function() {
        // Get price
        const amount = ether('0.1');
        const to = this.hParaSwap.address;

        // Call Paraswap Price API
        const priceData = await getPriceData(
          NATIVE_TOKEN,
          NATIVE_TOKEN_DECIMAL,
          tokenAddress,
          tokenDecimal,
          amount
        );

        // Call Paraswap transaction API
        const txData = await getTransactionData(priceData, slippage);

        // Prepare handler data
        const callData = getCallData(HParaSwapV5, 'swap', [
          NATIVE_TOKEN,
          amount,
          tokenAddress,
          txData.data,
        ]);

        // Execute
        const receipt = await this.proxy.execMock(to, callData, {
          from: user,
          value: amount.add(ether('1')),
        });

        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );

        const userTokenBalanceAfter = await this.token.balanceOf.call(user);

        // verify user balance
        expect(handlerReturn).to.be.bignumber.eq(
          userTokenBalanceAfter.sub(userTokenBalance)
        );

        // proxy should not have remaining token
        expect(
          await this.token.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.zero;

        // Verify ether balance
        expect(await proxyBalance.get()).to.be.bignumber.zero;
        expect(await userBalance.delta()).to.be.bignumber.eq(
          ether('0')
            .sub(amount)
            .sub(new BN(receipt.receipt.gasUsed))
        );
      });

      it('should revert: wrong src token(erc20)', async function() {
        // Get price
        const amount = ether('0.1');
        const to = this.hParaSwap.address;

        // Call Paraswap Price API
        const priceData = await getPriceData(
          NATIVE_TOKEN,
          NATIVE_TOKEN_DECIMAL,
          tokenAddress,
          tokenDecimal,
          amount
        );

        // Call Paraswap transaction API
        const txData = await getTransactionData(priceData, slippage);

        // Prepare handler data
        const callData = getCallData(HParaSwapV5, 'swap', [
          wrongTokenAddress,
          amount,
          tokenAddress,
          txData.data,
        ]);

        // Execute
        await expectRevert(
          this.proxy.execMock(to, callData, {
            from: user,
            value: amount,
          }),
          'HParaSwapV5_paraswap: Incorrect amount of ETH sent'
        );
      });

      it('should revert: msg.value less than api amount', async function() {
        // Get price
        const amount = ether('0.1');
        const to = this.hParaSwap.address;

        // Call Paraswap Price API
        const priceData = await getPriceData(
          NATIVE_TOKEN,
          NATIVE_TOKEN_DECIMAL,
          tokenAddress,
          tokenDecimal,
          amount
        );

        // Call Paraswap transaction API
        const txData = await getTransactionData(priceData, slippage);

        // Prepare handler data
        const callData = getCallData(HParaSwapV5, 'swap', [
          wrongTokenAddress,
          amount.sub(ether('0.05')),
          tokenAddress,
          txData.data,
        ]);

        // Execute
        await expectRevert(
          this.proxy.execMock(to, callData, {
            from: user,
            value: amount.sub(ether('0.05')),
          }),
          'HParaSwapV5_paraswap: Incorrect amount of ETH sent'
        );
      });
    });
  }); // describe('ether to token') end

  describe('token to ether', function() {
    const tokenAddress = DAI_TOKEN;
    const tokenDecimal = 18;
    const slippageInBps = 100; // 1%
    let providerAddress;
    before(async function() {
      providerAddress = await tokenProviderYearn(tokenAddress);
      this.token = await IToken.at(tokenAddress);
    });

    beforeEach(async function() {
      userBalance = await tracker(user);
      proxyBalance = await tracker(this.proxy.address);
      userTokenBalance = await this.token.balanceOf.call(user);
      proxyTokenBalance = await this.token.balanceOf.call(this.proxy.address);
    });

    it.only('normal', async function() {
      // Get price
      const amount = ether('5000');
      const to = this.hParaSwap.address;

      // Call Paraswap Price API
      const priceData = await getPriceData(
        tokenAddress,
        tokenDecimal,
        NATIVE_TOKEN,
        NATIVE_TOKEN_DECIMAL,
        amount
      );

      const expectReceivedAmount = priceData.priceRoute.destAmount;

      console.log('expectReceivedAmount');
      console.log(expectReceivedAmount);

      // Call Paraswap transaction API
      const txData = await getTransactionData(priceData, slippageInBps);

      // Prepare handler data
      const callData = getCallData(HParaSwapV5, 'swap', [
        tokenAddress,
        amount,
        NATIVE_TOKEN,
        txData.data,
      ]);

      // transfer token to proxy
      await this.token.transfer(this.proxy.address, amount, {
        from: providerAddress,
      });

      // Execute
      const receipt = await this.proxy.execMock(to, callData, {
        from: user,
      });

      const handlerReturn = utils.toBN(
        getHandlerReturn(receipt, ['uint256'])[0]
      );
      console.log('handlerReturn');
      console.log(handlerReturn.toString());

      //verify user balance
      const userBalanceDelta = await userBalance.delta();
      expect(handlerReturn).to.be.bignumber.eq(
        userBalanceDelta.add(new BN(receipt.receipt.gasUsed))
      );

      // proxy should not have remaining token
      expect(
        await this.token.balanceOf.call(this.proxy.address)
      ).to.be.bignumber.zero;

      // verify ether balance
      expect(await proxyBalance.get()).to.be.bignumber.zero;
      expect(userBalanceDelta).to.be.bignumber.gt(
        mulPercent(expectReceivedAmount, 100 - slippageInBps / 100).sub(
          new BN(receipt.receipt.gasUsed)
        )
      );
    });
  }); //describe('token to ether') end

  describe('positive slippage', function() {});
});
