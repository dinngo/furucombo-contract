const {
  balance,
  BN,
  ether,
  expectRevert,
} = require('@openzeppelin/test-helpers');
const { tracker } = balance;
const utils = web3.utils;
const { expect, assert } = require('chai');
const {
  DAI_TOKEN,
  USDC_TOKEN,
  COMBO_TOKEN,
  NATIVE_TOKEN,
  NATIVE_TOKEN_DECIMAL,
} = require('./utils/constants');
const {
  evmRevert,
  evmSnapshot,
  mulPercent,
  getHandlerReturn,
  getCallData,
  tokenProviderYearn,
  impersonateAndInjectEther,
} = require('./utils/utils');
const fetch = require('node-fetch');
const queryString = require('query-string');

const HParaSwapV5 = artifacts.require('HParaSwapV5');
const Registry = artifacts.require('Registry');
const Proxy = artifacts.require('ProxyMock');
const IToken = artifacts.require('IERC20');

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

const USER_ADDRESS = '0x1b57b3A1d5b4aa8E218F54FafB00975699463e6e'; // this is test case user address
const COMBO_PROVIDER = '0xb61B8EF639209a8292f88956319172337dFC0Ca5';
const sleep = delay => new Promise(resolve => setTimeout(resolve, delay));

async function getPriceData(
  srcToken,
  srcDecimals,
  destToken,
  destDecimals,
  amount,
  route = ''
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
      route: route,
    },
  });

  // Call Paraswap price API
  let priceResponse;
  let priceData;
  let succ = false;
  while (!succ) {
    priceResponse = await fetch(priceReq);
    priceData = await priceResponse.json();
    succ = priceResponse.ok;
    if (succ === false) {
      if (priceData.error === 'Server too busy') {
        // if the fail reason is 'Server too busy', try again
        console.log('ParaSwap Server too busy... retry');
        await sleep(500);
      } else {
        assert.fail(priceData.error);
      }
    }
  }

  return priceData;
}

async function getTransactionData(priceData, slippageInBps) {
  const body = {
    srcToken: priceData.priceRoute.srcToken,
    srcDecimals: priceData.priceRoute.srcDecimals,
    destToken: priceData.priceRoute.destToken,
    destDecimals: priceData.priceRoute.destDecimals,
    srcAmount: priceData.priceRoute.srcAmount,
    slippage: slippageInBps,
    userAddress: USER_ADDRESS,
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

contract('ParaSwapV5', function([_, user, user2]) {
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
      params: [COMBO_PROVIDER],
    });

    await impersonateAndInjectEther(COMBO_PROVIDER);
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
    const slippageInBps = 100; // 1%
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

        const expectReceivedAmount = priceData.priceRoute.destAmount;

        // Call Paraswap transaction API
        const txData = await getTransactionData(priceData, slippageInBps);

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
        expect(userTokenBalanceAfter.sub(userTokenBalance)).to.be.bignumber.gt(
          mulPercent(expectReceivedAmount, 100 - slippageInBps / 100)
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
        const txData = await getTransactionData(priceData, slippageInBps);

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

      it('should revert: wrong destination token(erc20)', async function() {
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
        const txData = await getTransactionData(priceData, slippageInBps);

        // Prepare handler data
        const callData = getCallData(HParaSwapV5, 'swap', [
          NATIVE_TOKEN,
          amount,
          wrongTokenAddress,
          txData.data,
        ]);

        // Execute
        await expectRevert(
          this.proxy.execMock(to, callData, {
            from: user,
            value: amount,
          }),
          'HParaSwapV5_swap: Invalid output token amount'
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
        const txData = await getTransactionData(priceData, slippageInBps);

        // Prepare handler data
        const callData = getCallData(HParaSwapV5, 'swap', [
          NATIVE_TOKEN,
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
          'HParaSwapV5__paraswapCall:'
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
      proxyBalance = await tracker(this.proxy.address);
    });

    it('normal', async function() {
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

    it('should revert: not enough srcToken', async function() {
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
      await this.token.transfer(this.proxy.address, amount.sub(ether('1')), {
        from: providerAddress,
      });

      // Execute
      await expectRevert(
        this.proxy.execMock(to, callData, {
          from: user,
        }),
        'HParaSwapV5__paraswapCall'
      );
    });
  }); //describe('token to ether') end

  describe('token to token', function() {
    const token1Address = DAI_TOKEN;
    const token1Decimal = 18;
    const token2Address = COMBO_TOKEN;
    const token2Decimal = 18;
    const slippageInBps = 100; // 1%
    let providerAddress;
    before(async function() {
      providerAddress = await tokenProviderYearn(token1Address);
      this.token = await IToken.at(token1Address);
      this.token2 = await IToken.at(token2Address);
    });

    it('normal', async function() {
      // Get price
      const amount = ether('500');
      const to = this.hParaSwap.address;

      // Call Paraswap Price API
      const priceData = await getPriceData(
        token1Address,
        token1Decimal,
        token2Address,
        token2Decimal,
        amount
      );

      const expectReceivedAmount = priceData.priceRoute.destAmount;

      // Call Paraswap transaction API
      const txData = await getTransactionData(priceData, slippageInBps);

      // Prepare handler data
      const callData = getCallData(HParaSwapV5, 'swap', [
        token1Address,
        amount,
        token2Address,
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

      const userToken2Balance = await this.token2.balanceOf.call(user);

      //verify user balance
      expect(handlerReturn).to.be.bignumber.eq(userToken2Balance);
      expect(userToken2Balance).to.be.bignumber.gt(
        mulPercent(expectReceivedAmount, 100 - slippageInBps / 100)
      );

      // proxy should not have remaining token
      expect(
        await this.token2.balanceOf.call(this.proxy.address)
      ).to.be.bignumber.zero;
    });
  }); //describe('token to token') end

  describe('positive slippage', function() {
    const tokenAddress = COMBO_TOKEN;
    const tokenDecimal = 18;
    const slippageInBps = 5000; // 50%
    before(async function() {
      this.token = await IToken.at(tokenAddress);
    });
    beforeEach(async function() {
      userBalance = await tracker(user);
    });
    it('swap COMBO for ETH with positive slippage', async function() {
      const comboAmount = ether('50000');
      const to = this.hParaSwap.address;

      // Call Paraswap Price API
      const comboToEthPriceData = await getPriceData(
        tokenAddress,
        tokenDecimal,
        NATIVE_TOKEN,
        NATIVE_TOKEN_DECIMAL,
        comboAmount,
        tokenAddress + '-' + NATIVE_TOKEN
      );

      const expectReceivedEthAmount = comboToEthPriceData.priceRoute.destAmount;

      // Call Paraswap transaction API
      const comboToEthTxData = await getTransactionData(
        comboToEthPriceData,
        slippageInBps
      );

      // Prepare handler data
      const comboToEthCallData = getCallData(HParaSwapV5, 'swap', [
        tokenAddress,
        comboAmount,
        NATIVE_TOKEN,
        comboToEthTxData.data,
      ]);

      //----- Try to pump COMBO
      const ethAmount = ether('20');
      const ethToComboPriceData = await getPriceData(
        NATIVE_TOKEN,
        NATIVE_TOKEN_DECIMAL,
        tokenAddress,
        tokenDecimal,
        ethAmount,
        NATIVE_TOKEN + '-' + tokenAddress
      );
      const ethToComboTxData = await getTransactionData(
        ethToComboPriceData,
        slippageInBps
      );
      const ethToComboCallData = getCallData(HParaSwapV5, 'swap', [
        NATIVE_TOKEN,
        ethAmount,
        tokenAddress,
        ethToComboTxData.data,
      ]);
      await this.proxy.execMock(to, ethToComboCallData, {
        from: user2,
        value: ethAmount,
      });
      //-----

      // transfer token to proxy
      await this.token.transfer(this.proxy.address, comboAmount, {
        from: COMBO_PROVIDER,
      });

      const receipt = await this.proxy.execMock(to, comboToEthCallData, {
        from: user,
      });

      const handlerReturn = utils.toBN(
        getHandlerReturn(receipt, ['uint256'])[0]
      );

      // should have positive slippage
      const userBalanceDelta = await userBalance.delta();
      expect(handlerReturn).to.be.bignumber.gt(expectReceivedEthAmount);
      expect(userBalanceDelta).to.be.bignumber.gt(expectReceivedEthAmount);

      // TODO:verify partner fee.
    });
  });
});
