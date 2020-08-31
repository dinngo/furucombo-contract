const {
  balance,
  BN,
  constants,
  ether,
  expectEvent,
  expectRevert,
  time,
} = require('@openzeppelin/test-helpers');
const { tracker } = balance;
const { MAX_UINT256 } = constants;
const { latest } = time;
const abi = require('ethereumjs-abi');
const utils = web3.utils;
const { expect } = require('chai');
const {
  DAI_TOKEN,
  DAI_PROVIDER,
  DAI_SYMBOL,
  USDC_TOKEN,
  USDC_SYMBOL,
  ZRX_TOKEN,
  ZRX_SYMBOL,
  KNC_TOKEN,
  KNC_SYMBOL,
} = require('./utils/constants');
const { evmRevert, evmSnapshot, profileGas } = require('./utils/utils');
const fetch = require('node-fetch');
const queryString = require('query-string');

const HOneInch = artifacts.require('HOneInch');
const Registry = artifacts.require('Registry');
const Proxy = artifacts.require('ProxyMock');
const IToken = artifacts.require('IERC20');

contract('OneInch Swap', function([_, user]) {
  let id;

  before(async function() {
    this.registry = await Registry.new();
    this.honeinch = await HOneInch.new();
    await this.registry.register(
      this.honeinch.address,
      utils.asciiToHex('OneInch')
    );
    this.proxy = await Proxy.new(this.registry.address);
  });

  beforeEach(async function() {
    id = await evmSnapshot();
  });

  afterEach(async function() {
    await evmRevert(id);
  });

  describe('Ether to Token', function() {
    const tokenAddress = DAI_TOKEN;
    const tokenSymbol = DAI_SYMBOL;

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

    describe('Exact input', function() {
      it('normal', async function() {
        const value = ether('1');
        const to = this.honeinch.address;
        const slippage = 3;

        const swapReq = queryString.stringifyUrl({
          url: 'https://api.1inch.exchange/v1.1/swapQuote',
          query: {
            fromTokenSymbol: 'ETH',
            toTokenSymbol: tokenSymbol,
            amount: value,
            slippage: slippage,
            disableEstimate: true,
            fromAddress: user,
            disabledExchangesList: '0x Relays,Mooniswap,Uniswap V2',
          },
        });

        const swapResponse = await fetch(swapReq);
        const swapData = await swapResponse.json();
        const data = swapData.data;
        const quote = swapData.toTokenAmount;
        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: value,
        });

        expect(await this.token.balanceOf.call(user)).to.be.bignumber.gte(
          // sub 1 more percent to tolerate the slippage calculation difference with 1inch
          tokenUser.add(mulPercent(quote, 100 - slippage - 1))
        );
        expect(
          await this.token.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.eq(ether('0'));
        expect(await balanceProxy.get()).to.be.bignumber.eq(ether('0'));
        expect(await balanceUser.delta()).to.be.bignumber.eq(
          ether('0')
            .sub(value)
            .sub(new BN(receipt.receipt.gasUsed))
        );

        profileGas(receipt);
      });

      it('msg.value greater than input ether amount', async function() {
        const value = ether('1');
        const to = this.honeinch.address;
        const slippage = 3;

        const swapReq = queryString.stringifyUrl({
          url: 'https://api.1inch.exchange/v1.1/swapQuote',
          query: {
            fromTokenSymbol: 'ETH',
            toTokenSymbol: tokenSymbol,
            amount: value,
            slippage: slippage,
            disableEstimate: true,
            fromAddress: user,
            disabledExchangesList: '0x Relays,Mooniswap,Uniswap V2',
          },
        });

        const swapResponse = await fetch(swapReq);
        const swapData = await swapResponse.json();
        const data = swapData.data;
        const quote = swapData.toTokenAmount;
        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: value.add(ether('1')),
        });

        expect(await this.token.balanceOf.call(user)).to.be.bignumber.gte(
          // sub 1 more percent to tolerate the slippage calculation difference with 1inch
          tokenUser.add(mulPercent(quote, 100 - slippage - 1))
        );
        expect(
          await this.token.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.eq(ether('0'));
        expect(await balanceProxy.get()).to.be.bignumber.eq(ether('0'));
        expect(await balanceUser.delta()).to.be.bignumber.eq(
          ether('0')
            .sub(value)
            .sub(new BN(receipt.receipt.gasUsed))
        );

        profileGas(receipt);
      });
    });
  });

  describe('Token to Ether', function() {
    const tokenAddress = DAI_TOKEN;
    const tokenSymbol = DAI_SYMBOL;
    const providerAddress = DAI_PROVIDER;

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

    describe('Exact input', function() {
      it('normal', async function() {
        const value = ether('50');
        const to = this.honeinch.address;
        const slippage = 3;

        const swapReq = queryString.stringifyUrl({
          url: 'https://api.1inch.exchange/v1.1/swapQuote',
          query: {
            fromTokenSymbol: tokenSymbol,
            toTokenSymbol: 'ETH',
            amount: value,
            slippage: slippage,
            disableEstimate: true,
            fromAddress: providerAddress,
            disabledExchangesList: '0x Relays,Mooniswap,Uniswap V2',
          },
        });

        await this.token.transfer(this.proxy.address, value, {
          from: providerAddress,
        });
        await this.proxy.updateTokenMock(this.token.address);

        const swapResponse = await fetch(swapReq);
        const swapData = await swapResponse.json();
        const data = swapData.data;
        const quote = swapData.toTokenAmount;
        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: ether('0.1'),
        });

        expect(await this.token.balanceOf.call(user)).to.be.bignumber.eq(
          tokenUser
        );
        expect(
          await this.token.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.eq(ether('0'));
        expect(await balanceProxy.get()).to.be.bignumber.eq(ether('0'));
        expect(await balanceUser.delta()).to.be.bignumber.gte(
          ether('0')
            // sub 1 more percent to tolerate the slippage calculation difference with 1inch
            .add(mulPercent(quote, 100 - slippage - 1))
            .sub(new BN(receipt.receipt.gasUsed))
        );

        profileGas(receipt);
      });
    });
  });

  describe('Token to Token', function() {
    const token0Address = DAI_TOKEN;
    const token0Symbol = DAI_SYMBOL;
    const token1Address = USDC_TOKEN;
    const token1Symbol = USDC_SYMBOL;
    const providerAddress = DAI_PROVIDER;

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

    describe('Exact input', function() {
      it('normal', async function() {
        const value = ether('50');
        const to = this.honeinch.address;
        const slippage = 3;

        const swapReq = queryString.stringifyUrl({
          url: 'https://api.1inch.exchange/v1.1/swapQuote',
          query: {
            fromTokenSymbol: token0Symbol,
            toTokenSymbol: token1Symbol,
            amount: value,
            slippage: slippage,
            disableEstimate: true,
            fromAddress: providerAddress,
            disabledExchangesList: '0x Relays,Mooniswap,Uniswap V2',
          },
        });

        await this.token0.transfer(this.proxy.address, value, {
          from: providerAddress,
        });
        await this.proxy.updateTokenMock(this.token0.address);

        const swapResponse = await fetch(swapReq);
        const swapData = await swapResponse.json();
        const data = swapData.data;
        const quote = swapData.toTokenAmount;
        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: ether('0.1'),
        });

        expect(await this.token0.balanceOf.call(user)).to.be.bignumber.eq(
          token0User
        );
        expect(
          await this.token0.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.eq(ether('0'));
        expect(
          await this.token1.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.eq(ether('0'));
        expect(await this.token1.balanceOf.call(user)).to.be.bignumber.gte(
          // sub 1 more percent to tolerate the slippage calculation difference with 1inch
          token1User.add(mulPercent(quote, 100 - slippage - 1))
        );

        profileGas(receipt);
      });
    });
  });
});

function mulPercent(num, percentage) {
  return new BN(num).mul(new BN(percentage)).div(new BN(100));
}
