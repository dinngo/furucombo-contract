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
const { resetAccount, profileGas } = require('./utils/utils');
const fetch = require('node-fetch');
const queryString = require('query-string');

const HOneInch = artifacts.require('HOneInch');
const Registry = artifacts.require('Registry');
const Proxy = artifacts.require('ProxyMock');
const IToken = artifacts.require('IERC20');

contract('OneInch Swap', function([_, deployer, user, someone]) {
  before(async function() {
    this.registry = await Registry.new();
    this.honeinch = await HOneInch.new();
    await this.registry.register(
      this.honeinch.address,
      utils.asciiToHex('OneInch')
    );
  });

  beforeEach(async function() {
    await resetAccount(_);
    await resetAccount(user);
    this.proxy = await Proxy.new(this.registry.address);
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
        const slippage = 99;

        const swapReq = queryString.stringifyUrl({
          url: "https://api.1inch.exchange/v1.1/swapQuote",
          query: {
            fromTokenSymbol: "ETH",
            toTokenSymbol: tokenSymbol,
            amount: value,
            slippage: slippage,
            disableEstimate: true,
            fromAddress: user,
            disabledExchangesList: "0x Relays",
          },
        });
        
        const swapReponse = await fetch(swapReq);
        const swapData = await swapReponse.json();
        const data = swapData.data;
        const quote = swapData.toTokenAmount;
        const receipt = await this.proxy.execMock(to, data, { from: user, value: value });

        expect(await this.token.balanceOf.call(user)).to.be.bignumber.gte(
          tokenUser.add(mulPercent(quote, 100 - slippage))
        );
        expect(
          await this.token.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.eq(ether('0'));
        expect(
          await balanceProxy.get()
        ).to.be.bignumber.eq(ether('0'));
        expect(await balanceUser.delta()).to.be.bignumber.eq(
          ether('0')
            .sub(value)
            .sub(new BN(receipt.receipt.gasUsed))
        );

        profileGas(receipt);
      });

      it('msg.value gretter than input ether amount', async function() {

        const value = ether('1');
        const to = this.honeinch.address;
        const slippage = 99;

        const swapReq = queryString.stringifyUrl({
          url: "https://api.1inch.exchange/v1.1/swapQuote",
          query: {
            fromTokenSymbol: "ETH",
            toTokenSymbol: tokenSymbol,
            amount: value,
            slippage: slippage,
            disableEstimate: true,
            fromAddress: user,
            disabledExchangesList: "0x Relays",
          },
        });
        
        const swapReponse = await fetch(swapReq);
        const swapData = await swapReponse.json();
        const data = swapData.data;
        const quote = swapData.toTokenAmount;
        const receipt = await this.proxy.execMock(to, data, { from: user, value: value.add(ether('1')) });

        expect(await this.token.balanceOf.call(user)).to.be.bignumber.gte(
          tokenUser.add(mulPercent(quote, 100 - slippage))
        );
        expect(
          await this.token.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.eq(ether('0'));
        expect(
          await balanceProxy.get()
        ).to.be.bignumber.eq(ether('0'));
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

        const value = ether('100');
        const to = this.honeinch.address;
        const slippage = 99;

        const swapReq = queryString.stringifyUrl({
          url: "https://api.1inch.exchange/v1.1/swapQuote",
          query: {
            fromTokenSymbol: tokenSymbol,
            toTokenSymbol: "ETH",
            amount: value,
            slippage: slippage,
            disableEstimate: true,
            fromAddress: providerAddress,
            disabledExchangesList: "0x Relays",
          },
        });

        await this.token.transfer(this.proxy.address, value, {
          from: providerAddress
        });
        await this.proxy.updateTokenMock(this.token.address);
        
        const swapReponse = await fetch(swapReq);
        const swapData = await swapReponse.json();
        const data = swapData.data;
        const quote = swapData.toTokenAmount;
        const receipt = await this.proxy.execMock(to, data, { from: user, value: ether('0.1') });

        expect(await this.token.balanceOf.call(user)).to.be.bignumber.eq(
          tokenUser
        );
        expect(
          await this.token.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.eq(ether('0'));
        expect(
          await balanceProxy.get()
        ).to.be.bignumber.eq(ether('0'));
        expect(await balanceUser.delta()).to.be.bignumber.gte(
          ether('0')
            .add(mulPercent(quote, 100 - slippage))
            .sub(new BN(receipt.receipt.gasUsed))
        );

        profileGas(receipt);
      });
    });

  });

  describe('Token to Token', function() {
    const token0Address = DAI_TOKEN;
    const token0Symbol = DAI_SYMBOL;
    const token1Address = KNC_TOKEN;
    const token1Symbol = KNC_SYMBOL;
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

        const value = ether('10');
        const to = this.honeinch.address;
        const slippage = 99;

        const swapReq = queryString.stringifyUrl({
          url: "https://api.1inch.exchange/v1.1/swapQuote",
          query: {
            fromTokenSymbol: token0Symbol,
            toTokenSymbol: token1Symbol,
            amount: value,
            slippage: slippage,
            disableEstimate: true,
            fromAddress: providerAddress,
            disabledExchangesList: "0x Relays",
          },
        });

        await this.token0.transfer(this.proxy.address, value, {
          from: providerAddress
        });
        await this.proxy.updateTokenMock(this.token0.address);
        
        const swapReponse = await fetch(swapReq);
        const swapData = await swapReponse.json();
        const data = swapData.data;
        const quote = swapData.toTokenAmount;
        const receipt = await this.proxy.execMock(to, data, { from: user, value: ether('0.1') });

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
          token1User
            .add(mulPercent(quote, 100 - slippage))
        );

        profileGas(receipt);
      });
    });

  });
  
});

function mulPercent(num, percentage) {
  return (new BN(num)).mul(new BN(percentage)).div(new BN(100));
}