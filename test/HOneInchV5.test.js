const chainId = network.config.chainId;
if (
  chainId == 1 ||
  chainId == 10 ||
  chainId == 137 ||
  chainId == 42161 ||
  chainId == 43114
) {
  // This test supports to run on these chains.
} else {
  return;
}

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
  getCallData,
  getTokenProvider,
  callExternalApi,
} = require('./utils/utils');
const queryString = require('query-string');

const FeeRuleRegistry = artifacts.require('FeeRuleRegistry');
const HOneInch = artifacts.require('HOneInchV5');
const Registry = artifacts.require('Registry');
const Proxy = artifacts.require('ProxyMock');
const IToken = artifacts.require('IERC20');

/// Change url for different chain
/// - Ethereum: https://api.1inch.exchange/v5.0/1/
/// - Polygon: https://api.1inch.exchange/v5.0/137/
const URL_1INCH = 'https://api.1inch.exchange/v5.0/' + chainId + '/';
const URL_1INCH_SWAP = URL_1INCH + 'swap';

contract('OneInchV5 Swap', function([_, user]) {
  let id;

  before(async function() {
    // ============= 1inch API Health Check =============
    const healthCkeck = await callExternalApi(URL_1INCH + 'healthcheck');
    if (!healthCkeck.ok) {
      console.error(`=====> 1inch API not healthy now, skip the tests`);
      this.skip();
    }
    // ==================================================

    // Get 1inch router address
    const routerResponse = await callExternalApi(URL_1INCH + 'approve/spender');
    const routerAddress = (await routerResponse.json()).address;

    this.registry = await Registry.new();
    this.hOneInch = await HOneInch.new(routerAddress);
    await this.registry.register(
      this.hOneInch.address,
      utils.asciiToHex('OneInchV5')
    );
    this.feeRuleRegistry = await FeeRuleRegistry.new('0', _);
    this.proxy = await Proxy.new(
      this.registry.address,
      this.feeRuleRegistry.address
    );
  });

  beforeEach(async function() {
    id = await evmSnapshot();
  });

  afterEach(async function() {
    await evmRevert(id);
  });

  describe('Ether to Token', function() {
    const tokenAddress = DAI_TOKEN;

    let balanceUser;
    let balanceProxy;
    let tokenUser;

    before(async function() {
      this.token = await IToken.at(tokenAddress);
    });

    beforeEach(async function() {
      balanceUser = await tracker(user);
      balanceProxy = await tracker(this.proxy.address);
      tokenUser = await this.token.balanceOf.call(user);
    });

    describe('Swap', function() {
      it('normal', async function() {
        // Prepare data
        const value = ether('0.1');
        const to = this.hOneInch.address;
        const slippage = 3;
        const swapReq = queryString.stringifyUrl({
          url: URL_1INCH_SWAP,
          query: {
            fromTokenAddress: NATIVE_TOKEN_ADDRESS,
            toTokenAddress: tokenAddress,
            amount: value,
            slippage: slippage,
            disableEstimate: true,
            fromAddress: this.proxy.address,
          },
        });

        // Call 1inch API
        const swapResponse = await callExternalApi(swapReq);
        expect(swapResponse.ok, '1inch api response not ok').to.be.true;
        const swapData = await swapResponse.json();
        const quote = swapData.toTokenAmount;

        // Prepare handler data
        const data = getCallData(HOneInch, 'swap', [
          NATIVE_TOKEN_ADDRESS,
          value,
          tokenAddress,
          swapData.tx.data,
        ]);

        // Execute
        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: value,
        });

        // Verify return value
        const tokenUserEnd = await this.token.balanceOf.call(user);
        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );
        expect(handlerReturn).to.be.bignumber.eq(tokenUserEnd.sub(tokenUser));

        // Verify token balance
        expect(tokenUserEnd).to.be.bignumber.gte(
          // sub 1 more percent to tolerate the slippage calculation difference with 1inch
          tokenUser.add(mulPercent(quote, 100 - slippage - 1))
        );
        expect(
          await this.token.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.zero;

        // Verify ether balance
        expect(await balanceProxy.get()).to.be.bignumber.zero;
        expect(await balanceUser.delta()).to.be.bignumber.eq(
          ether('0').sub(value)
        );

        profileGas(receipt);
      });

      it('msg.value greater than input ether amount', async function() {
        const value = ether('0.1');
        const to = this.hOneInch.address;
        const slippage = 3;

        const swapReq = queryString.stringifyUrl({
          url: URL_1INCH_SWAP,
          query: {
            fromTokenAddress: NATIVE_TOKEN_ADDRESS,
            toTokenAddress: tokenAddress,
            amount: value,
            slippage: slippage,
            disableEstimate: true,
            fromAddress: this.proxy.address,
          },
        });

        // Call 1inch API
        const swapResponse = await callExternalApi(swapReq);
        expect(swapResponse.ok, '1inch api response not ok').to.be.true;
        const swapData = await swapResponse.json();
        const quote = swapData.toTokenAmount;

        // Prepare handler data
        const data = getCallData(HOneInch, 'swap', [
          NATIVE_TOKEN_ADDRESS,
          value,
          tokenAddress,
          swapData.tx.data,
        ]);

        // Execute
        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: value.add(ether('1')),
        });

        // Verify return value
        const tokenUserEnd = await this.token.balanceOf.call(user);
        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );
        expect(handlerReturn).to.be.bignumber.eq(tokenUserEnd.sub(tokenUser));

        // Verify token balance
        expect(tokenUserEnd).to.be.bignumber.gte(
          // sub 1 more percent to tolerate the slippage calculation difference with 1inch
          tokenUser.add(mulPercent(quote, 100 - slippage - 1))
        );
        expect(
          await this.token.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.zero;

        // Verify ether balance
        expect(await balanceProxy.get()).to.be.bignumber.zero;
        expect(await balanceUser.delta()).to.be.bignumber.eq(
          ether('0').sub(value)
        );

        profileGas(receipt);
      });

      it('should revert: wrong src token amount(ether)', async function() {
        const value = ether('0.1');
        const to = this.hOneInch.address;
        const slippage = 3;
        const swapReq = queryString.stringifyUrl({
          url: URL_1INCH_SWAP,
          query: {
            fromTokenAddress: NATIVE_TOKEN_ADDRESS,
            toTokenAddress: tokenAddress,
            amount: value,
            slippage: slippage,
            disableEstimate: true,
            fromAddress: this.proxy.address,
          },
        });

        // Call 1inch API
        const swapResponse = await callExternalApi(swapReq);
        expect(swapResponse.ok, '1inch api response not ok').to.be.true;
        const swapData = await swapResponse.json();

        // Prepare handler data
        const data = getCallData(HOneInch, 'swap', [
          NATIVE_TOKEN_ADDRESS,
          value.sub(new BN(1000)),
          tokenAddress,
          swapData.tx.data,
        ]);

        // Execute
        await expectRevert.unspecified(
          this.proxy.execMock(to, data, { from: user, value: ether('0.1') })
        );
      });
    });
  });

  describe('Token to Ether', function() {
    const tokenAddress = DAI_TOKEN;

    let balanceUser;
    let balanceProxy;
    let tokenUser;
    let providerAddress;

    before(async function() {
      providerAddress = await getTokenProvider(tokenAddress);

      this.token = await IToken.at(tokenAddress);
    });

    beforeEach(async function() {
      balanceUser = await tracker(user);
      balanceProxy = await tracker(this.proxy.address);
      tokenUser = await this.token.balanceOf.call(user);
    });

    describe('Swap', function() {
      it('normal', async function() {
        // Prepare data
        const value = ether('100');
        const to = this.hOneInch.address;
        const slippage = 3;
        const swapReq = queryString.stringifyUrl({
          url: URL_1INCH_SWAP,
          query: {
            fromTokenAddress: tokenAddress,
            toTokenAddress: NATIVE_TOKEN_ADDRESS,
            amount: value,
            slippage: slippage,
            disableEstimate: true,
            fromAddress: this.proxy.address,
          },
        });

        // Transfer from token to Proxy first
        await this.token.transfer(this.proxy.address, value, {
          from: providerAddress,
        });
        await this.proxy.updateTokenMock(this.token.address);

        // Call 1inch API
        const swapResponse = await callExternalApi(swapReq);
        expect(swapResponse.ok, '1inch api response not ok').to.be.true;
        const swapData = await swapResponse.json();
        const quote = swapData.toTokenAmount;

        // Prepare handler data
        const data = getCallData(HOneInch, 'swap', [
          tokenAddress,
          value,
          NATIVE_TOKEN_ADDRESS,
          swapData.tx.data,
        ]);

        // Execute
        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: ether('0.1'),
        });

        // Verify return value
        const balanceUserDelta = await balanceUser.delta();
        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );
        expect(handlerReturn).to.be.bignumber.eq(balanceUserDelta);

        // Verify token balance
        expect(await this.token.balanceOf.call(user)).to.be.bignumber.eq(
          tokenUser
        );
        expect(
          await this.token.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.zero;

        // Verify ether balance
        expect(await balanceProxy.get()).to.be.bignumber.zero;
        expect(balanceUserDelta).to.be.bignumber.gte(
          ether('0')
            // sub 1 more percent to tolerate the slippage calculation difference with 1inch
            .add(mulPercent(quote, 100 - slippage - 1))
        );

        profileGas(receipt);
      });
    });
  });

  describe('Token to Token', function() {
    const token0Address = DAI_TOKEN;
    const token1Address = USDC_TOKEN;

    let balanceUser;
    let balanceProxy;
    let token0User;
    let token1User;
    let wethUser;
    let wethProxy;
    let providerAddress;

    before(async function() {
      providerAddress = await getTokenProvider(token0Address);

      this.token0 = await IToken.at(token0Address);
      this.token1 = await IToken.at(token1Address);
      this.weth = await IToken.at(WETH_TOKEN);
    });

    beforeEach(async function() {
      balanceUser = await tracker(user);
      balanceProxy = await tracker(this.proxy.address);
      token0User = await this.token0.balanceOf.call(user);
      token1User = await this.token1.balanceOf.call(user);
      wethUser = await this.weth.balanceOf.call(user);
      wethProxy = await this.weth.balanceOf.call(this.proxy.address);
    });

    describe('Swap', function() {
      it('normal', async function() {
        // Prepare data
        const value = ether('100');
        const to = this.hOneInch.address;
        const slippage = 3;
        const swapReq = queryString.stringifyUrl({
          url: URL_1INCH_SWAP,
          query: {
            fromTokenAddress: token0Address,
            toTokenAddress: token1Address,
            amount: value,
            slippage: slippage,
            disableEstimate: true,
            fromAddress: this.proxy.address,
          },
        });

        // Transfer from token to Proxy first
        await this.token0.transfer(this.proxy.address, value, {
          from: providerAddress,
        });
        await this.proxy.updateTokenMock(this.token0.address);

        // Call 1inch API
        const swapResponse = await callExternalApi(swapReq);
        expect(swapResponse.ok, '1inch api response not ok').to.be.true;
        const swapData = await swapResponse.json();
        const quote = swapData.toTokenAmount;

        // Prepare handler data
        const data = getCallData(HOneInch, 'swap', [
          token0Address,
          value,
          token1Address,
          swapData.tx.data,
        ]);

        // Execute
        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: ether('0.1'),
        });

        // Verify return value
        const token1UserEnd = await this.token1.balanceOf.call(user);
        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );
        expect(handlerReturn).to.be.bignumber.eq(token1UserEnd.sub(token1User));

        // Verify token0 balance
        expect(await this.token0.balanceOf.call(user)).to.be.bignumber.eq(
          token0User
        );
        expect(
          await this.token0.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.zero;

        // Verify token1 balance
        expect(await this.token1.balanceOf.call(user)).to.be.bignumber.gte(
          // sub 1 more percent to tolerate the slippage calculation difference with 1inch
          token1User.add(mulPercent(quote, 100 - slippage - 1))
        );
        expect(
          await this.token1.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.zero;

        // Verify ether balance
        expect(await balanceProxy.get()).to.be.bignumber.zero;
        expect(await balanceUser.delta()).to.be.bignumber.eq(ether('0'));

        profileGas(receipt);
      });

      it('to weth', async function() {
        // Prepare data
        const value = ether('100');
        const to = this.hOneInch.address;
        const slippage = 3;
        const swapReq = queryString.stringifyUrl({
          url: URL_1INCH_SWAP,
          query: {
            fromTokenAddress: token0Address,
            toTokenAddress: WETH_TOKEN,
            amount: value,
            slippage: slippage,
            disableEstimate: true,
            fromAddress: this.proxy.address,
          },
        });

        // Transfer from token to Proxy first
        await this.token0.transfer(this.proxy.address, value, {
          from: providerAddress,
        });
        await this.proxy.updateTokenMock(this.token0.address);

        // Call 1inch API
        const swapResponse = await callExternalApi(swapReq);
        expect(swapResponse.ok, '1inch api response not ok').to.be.true;
        const swapData = await swapResponse.json();
        const quote = swapData.toTokenAmount;

        // Prepare handler data
        const data = getCallData(HOneInch, 'swap', [
          token0Address,
          value,
          WETH_TOKEN,
          swapData.tx.data,
        ]);

        // Execute
        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: ether('0.1'),
        });

        // Verify return value
        const wethUserEnd = await this.weth.balanceOf.call(user);
        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );
        expect(handlerReturn).to.be.bignumber.eq(wethUserEnd.sub(wethUser));

        // Verify token0 balance
        expect(await this.token0.balanceOf.call(user)).to.be.bignumber.eq(
          token0User
        );
        expect(
          await this.token0.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.zero;

        // Verify weth balance
        expect(await this.weth.balanceOf.call(user)).to.be.bignumber.gte(
          // sub 1 more percent to tolerate the slippage calculation difference with 1inch
          wethUser.add(mulPercent(quote, 100 - slippage - 1))
        );
        expect(
          await this.weth.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.zero;

        // Verify ether balance
        expect(await balanceProxy.get()).to.be.bignumber.zero;
        expect(await balanceUser.delta()).to.be.bignumber.eq(ether('0'));

        profileGas(receipt);
      });

      it('append extra data to API data at the end', async function() {
        // Prepare data
        const appendData = 'ff0000ff';
        const value = ether('100');
        const to = this.hOneInch.address;
        const slippage = 3;
        const swapReq = queryString.stringifyUrl({
          url: URL_1INCH_SWAP,
          query: {
            fromTokenAddress: token0Address,
            toTokenAddress: WETH_TOKEN,
            amount: value,
            slippage: slippage,
            disableEstimate: true,
            fromAddress: this.proxy.address,
          },
        });

        // Transfer from token to Proxy first
        await this.token0.transfer(this.proxy.address, value, {
          from: providerAddress,
        });
        await this.proxy.updateTokenMock(this.token0.address);

        // Call 1inch API
        const swapResponse = await callExternalApi(swapReq);
        expect(swapResponse.ok, '1inch api response not ok').to.be.true;
        const swapData = await swapResponse.json();
        const quote = swapData.toTokenAmount;

        // Prepare handler data
        var data = getCallData(HOneInch, 'swap', [
          token0Address,
          value,
          WETH_TOKEN,
          swapData.tx.data,
        ]);
        data = data + appendData;

        // Execute
        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: ether('0.1'),
        });

        // Verify return value
        const wethUserEnd = await this.weth.balanceOf.call(user);
        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );
        expect(handlerReturn).to.be.bignumber.eq(wethUserEnd.sub(wethUser));

        // Verify token0 balance
        expect(await this.token0.balanceOf.call(user)).to.be.bignumber.eq(
          token0User
        );
        expect(
          await this.token0.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.zero;

        // Verify weth balance
        expect(await this.weth.balanceOf.call(user)).to.be.bignumber.gte(
          // sub 1 more percent to tolerate the slippage calculation difference with 1inch
          wethUser.add(mulPercent(quote, 100 - slippage - 1))
        );
        expect(
          await this.weth.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.zero;

        // Verify ether balance
        expect(await balanceProxy.get()).to.be.bignumber.zero;
        expect(await balanceUser.delta()).to.be.bignumber.eq(ether('0'));

        profileGas(receipt);
      });

      it('should revert: wrong dst token(ether)', async function() {
        // Prepare data
        const value = ether('100');
        const to = this.hOneInch.address;
        const slippage = 3;
        const swapReq = queryString.stringifyUrl({
          url: URL_1INCH_SWAP,
          query: {
            fromTokenAddress: token0Address,
            toTokenAddress: token1Address,
            amount: value,
            slippage: slippage,
            disableEstimate: true,
            fromAddress: this.proxy.address,
          },
        });

        // Transfer from token to Proxy first
        await this.token0.transfer(this.proxy.address, value, {
          from: providerAddress,
        });
        await this.proxy.updateTokenMock(this.token0.address);

        // Call 1inch API
        const swapResponse = await callExternalApi(swapReq);
        expect(swapResponse.ok, '1inch api response not ok').to.be.true;
        const swapData = await swapResponse.json();

        // Prepare handler data
        const data = getCallData(HOneInch, 'swap', [
          token0Address,
          value,
          NATIVE_TOKEN_ADDRESS,
          swapData.tx.data,
        ]);

        await expectRevert(
          this.proxy.execMock(to, data, { from: user, value: ether('0.1') }),
          '0_HOneInchV5_swap: Invalid output token amount'
        );
      });

      it('should revert: wrong dst token(erc20)', async function() {
        // Prepare data
        const value = ether('100');
        const to = this.hOneInch.address;
        const slippage = 3;
        const swapReq = queryString.stringifyUrl({
          url: URL_1INCH_SWAP,
          query: {
            fromTokenAddress: token0Address,
            toTokenAddress: token1Address,
            amount: value,
            slippage: slippage,
            disableEstimate: true,
            fromAddress: this.proxy.address,
          },
        });

        // Transfer from token to Proxy first
        await this.token0.transfer(this.proxy.address, value, {
          from: providerAddress,
        });
        await this.proxy.updateTokenMock(this.token0.address);

        // Call 1inch API
        const swapResponse = await callExternalApi(swapReq);
        expect(swapResponse.ok, '1inch api response not ok').to.be.true;
        const swapData = await swapResponse.json();

        // Prepare handler data
        const data = getCallData(HOneInch, 'swap', [
          token0Address,
          value,
          WETH_TOKEN,
          swapData.tx.data,
        ]);

        await expectRevert(
          this.proxy.execMock(to, data, { from: user, value: ether('0.1') }),
          '0_HOneInchV5_swap: Invalid output token amount'
        );
      });

      it('should revert: wrong src token(ether)', async function() {
        // Prepare data
        const value = ether('100');
        const to = this.hOneInch.address;
        const slippage = 3;
        const swapReq = queryString.stringifyUrl({
          url: URL_1INCH_SWAP,
          query: {
            fromTokenAddress: token0Address,
            toTokenAddress: token1Address,
            amount: value,
            slippage: slippage,
            disableEstimate: true,
            fromAddress: this.proxy.address,
          },
        });

        // Transfer from token to Proxy first
        await this.token0.transfer(this.proxy.address, value, {
          from: providerAddress,
        });
        await this.proxy.updateTokenMock(this.token0.address);

        // Call 1inch API
        const swapResponse = await callExternalApi(swapReq);
        expect(swapResponse.ok, '1inch api response not ok').to.be.true;
        const swapData = await swapResponse.json();

        // Prepare handler data
        const data = getCallData(HOneInch, 'swap', [
          NATIVE_TOKEN_ADDRESS,
          value,
          token1Address,
          swapData.tx.data,
        ]);

        await expectRevert.unspecified(
          this.proxy.execMock(to, data, { from: user, value: ether('0.1') })
        );
      });

      it('should revert: wrong src token(erc20)', async function() {
        // Prepare data
        const value = ether('100');
        const to = this.hOneInch.address;
        const slippage = 3;
        const swapReq = queryString.stringifyUrl({
          url: URL_1INCH_SWAP,
          query: {
            fromTokenAddress: token0Address,
            toTokenAddress: token1Address,
            amount: value,
            slippage: slippage,
            disableEstimate: true,
            fromAddress: this.proxy.address,
          },
        });

        // Transfer from token to Proxy first
        await this.token0.transfer(this.proxy.address, value, {
          from: providerAddress,
        });
        await this.proxy.updateTokenMock(this.token0.address);

        // Call 1inch API
        const swapResponse = await callExternalApi(swapReq);
        expect(swapResponse.ok, '1inch api response not ok').to.be.true;
        const swapData = await swapResponse.json();

        // Prepare handler data
        const data = getCallData(HOneInch, 'swap', [
          WETH_TOKEN,
          value,
          token1Address,
          swapData.tx.data,
        ]);

        await expectRevert.unspecified(
          this.proxy.execMock(to, data, { from: user, value: ether('0.1') })
        );
      });

      it('should revert: wrong src token amount(erc20)', async function() {
        // Prepare data
        const value = ether('100');
        const to = this.hOneInch.address;
        const slippage = 3;
        const swapReq = queryString.stringifyUrl({
          url: URL_1INCH_SWAP,
          query: {
            fromTokenAddress: token0Address,
            toTokenAddress: token1Address,
            amount: value,
            slippage: slippage,
            disableEstimate: true,
            fromAddress: this.proxy.address,
          },
        });

        // Transfer from token to Proxy first
        await this.token0.transfer(this.proxy.address, value, {
          from: providerAddress,
        });
        await this.proxy.updateTokenMock(this.token0.address);

        // Call 1inch API
        const swapResponse = await callExternalApi(swapReq);
        expect(swapResponse.ok, '1inch api response not ok').to.be.true;
        const swapData = await swapResponse.json();

        // Prepare handler data
        const data = getCallData(HOneInch, 'swap', [
          token0Address,
          value.sub(new BN(1000)),
          token1Address,
          swapData.tx.data,
        ]);

        await expectRevert.unspecified(
          this.proxy.execMock(to, data, { from: user, value: ether('0.1') })
        );
      });
    });
  });
});
