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
  NATIVE_TOKEN_ADDRESS,
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
const URL_PARASWAP_PRICE = URL_PARASWAP + 'prices';
const URL_PARASWAP_TRANSACTION =
  URL_PARASWAP + 'transactions/' + ETHEREUM_NETWORK_ID;
const BUY = 'BUY';
const SELL = 'SELL';

const BINANCE_WALLET = '0xF977814e90dA44bFA03b6295A0616a897441aceC';

contract('ParaswapV5', function([_, user]) {
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

    await network.provider.request({
      method: 'hardhat_impersonateAccount',
      params: [BINANCE_WALLET],
    });
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
    const slippage = 300; // 3%

    before(async function() {
      this.token = await IToken.at(tokenAddress);
    });

    beforeEach(async function() {
      balanceUser = await tracker(BINANCE_WALLET);
      balanceProxy = await tracker(this.proxy.address);
      tokenUser = await this.token.balanceOf.call(BINANCE_WALLET);
      tokenBalanceProxy = await this.token.balanceOf.call(this.proxy.address);
    });

    describe('Swap', function() {
      it('normal', async function() {
        // Get price
        const amount = ether('0.1');
        const to = this.hParaSwap.address;
        const priceReq = queryString.stringifyUrl({
          url: URL_PARASWAP_PRICE,
          query: {
            srcToken: NATIVE_TOKEN_ADDRESS,
            srcDecimals: 18,
            destToken: tokenAddress,
            destDecimals: 18,
            amount: amount,
            side: SELL,
            network: ETHEREUM_NETWORK_ID,
          },
        });

        // Call Paraswap price API
        const priceResponse = await fetch(priceReq);
        expect(priceResponse.ok, 'Paraswap api response not ok').to.be.true;
        const priceData = await priceResponse.json();

        console.log('priceData:');
        console.log(priceData);

        // Build Transaction
        const body = {
          srcToken: priceData.priceRoute.srcToken,
          srcDecimals: priceData.priceRoute.srcDecimals,
          destToken: priceData.priceRoute.destToken,
          destDecimals: priceData.priceRoute.destDecimals,
          srcAmount: priceData.priceRoute.srcAmount,
          slippage: slippage,
          userAddress: BINANCE_WALLET,
          // receiver: this.hParaSwap.address,
          priceRoute: priceData.priceRoute,
        };

        // console.log('JSON.stringify(body),');
        // console.log(JSON.stringify(body));
        const txResp = await fetch(URL_PARASWAP_TRANSACTION, {
          method: 'post',
          body: JSON.stringify(body),
          headers: { 'Content-Type': 'application/json' },
        });
        const txData = await txResp.json();
        console.log('txData:');
        console.log(txData);

        // Prepare handler data
        const callData = getCallData(HParaSwapV5, 'swap', [
          NATIVE_TOKEN_ADDRESS,
          amount,
          txData.data,
        ]);

        // Execute
        const receipt = await this.proxy.execMock(to, callData, {
          from: user,
          value: amount,
        });

        // Verify return value
        const tokenUserAfter = await this.token.balanceOf.call(BINANCE_WALLET);
        const tokenBalanceProxyAfter = await this.token.balanceOf.call(
          this.proxy.address
        );
        console.log('token change:' + tokenUserAfter.sub(tokenUser));
        console.log(
          'token change proxy:' + tokenBalanceProxyAfter.sub(tokenBalanceProxy)
        );
        // const handlerReturn = utils.toBN(
        //   getHandlerReturn(receipt, ['uint256'])[0]
        // );
        // expect(handlerReturn).to.be.bignumber.eq(tokenUserEnd.sub(tokenUser));

        // // Verify token balance
        // expect(tokenUserEnd).to.be.bignumber.gte(
        //   // sub 1 more percent to tolerate the slippage calculation difference with 1inch
        //   tokenUser.add(mulPercent(quote, 100 - slippage - 1))
        // );
        // expect(
        //   await this.token.balanceOf.call(this.proxy.address)
        // ).to.be.bignumber.zero;

        // // Verify ether balance
        // expect(await balanceProxy.get()).to.be.bignumber.zero;
        // expect(await balanceUser.delta()).to.be.bignumber.eq(
        //   ether('0')
        //     .sub(value)
        //     .sub(new BN(receipt.receipt.gasUsed))
        // );

        // profileGas(receipt);
      });
    });
  });
});
