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
  BAT_TOKEN,
  ZRX_TOKEN,
  USDT_TOKEN,
  USDT_PROVIDER,
  ETH_TOKEN,
  WETH_TOKEN,
  ONEINCH_PROXY,
  ONEINCH_TOKEN_SPENDER,
} = require('./utils/constants');
const { resetAccount, profileGas } = require('./utils/utils');
const fetch = require('node-fetch');
const queryString = require('query-string');

const HOneInch = artifacts.require('HOneInch');
const Registry = artifacts.require('Registry');
const Proxy = artifacts.require('ProxyMock');
const IToken = artifacts.require('IERC20');
const IOneInchExchange = artifacts.require('IOneInchExchange');

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

  // describe('Ether to Token', function() {
  //   const tokenAddress = DAI_TOKEN;

  //   let balanceUser;
  //   let balanceProxy;
  //   let tokenUser;

  //   before(async function() {
  //     this.token = await IToken.at(tokenAddress);
  //   });

  //   beforeEach(async function() {
  //     balanceUser = await tracker(user);
  //     balanceProxy = await tracker(this.proxy.address);
  //     tokenUser = await this.token.balanceOf.call(user);
  //   });

  //   describe('Exact input', function() {
  //     it('normal', async function() {

  //       const value = ether('1');
  //       const to = this.honeinch.address;

  //       const quoteReq = queryString.stringifyUrl({
  //         url: "https://api.1inch.exchange/v1.1/quote",
  //         query: {
  //           fromTokenAddress: ETH_TOKEN,
  //           toTokenAddress: this.token.address,
  //           amount: value,
  //         },
  //       });
  //       const swapReq = queryString.stringifyUrl({
  //         url: "https://api.1inch.exchange/v1.1/swap",
  //         query: {
  //           // fromTokenAddress: ETH_TOKEN,
  //           // toTokenAddress: this.token.address,
  //           fromTokenSymbol: "ETH",
  //           toTokenSymbol: "DAI",
  //           amount: value,
  //           slippage: 1,
  //           disableEstimate: true,
  //           fromAddress: user,
  //         },
  //       });
  //       console.log(`swapReq: ${swapReq}`);
        
  //       const quoteReponse = await fetch(quoteReq);
  //       const quoteData = await quoteReponse.json();
  //       const quote = quoteData.toTokenAmount;
  //       console.log(`quote = ${quote}`);
        
  //       const swapReponse = await fetch(swapReq);
  //       const swapData = await swapReponse.json();
  //       const data = swapData.data;
  //       console.log(`swapData = ${JSON.stringify(swapData)}`);
  //       console.log(`proxy address = ${JSON.stringify(this.proxy.address)}`);
  //       console.log(`honeinch address = ${JSON.stringify(this.honeinch.address)}`);

  //       const receipt = await this.proxy.execMock(to, data, { from: user, value: value });
  //       const bal = await this.token.balanceOf.call(user);
  //       console.log(`bat balance: ${web3.utils.fromWei(bal)}`);

  //       expect(await this.token.balanceOf.call(user)).to.be.bignumber.gte(
  //         tokenUser.add(mulPercent(quote, 98))
  //       );
  //       expect(
  //         await this.token.balanceOf.call(this.proxy.address)
  //       ).to.be.bignumber.eq(ether('0'));
  //       expect(
  //         await balanceProxy.get()
  //       ).to.be.bignumber.eq(ether('0'));
  //       expect(await balanceUser.delta()).to.be.bignumber.eq(
  //         ether('0')
  //           .sub(value)
  //           .sub(new BN(receipt.receipt.gasUsed))
  //       );

  //       profileGas(receipt);
  //     });
  //   });

  // });


  // describe('Token to Token', function() {
  //   const token0Address = DAI_TOKEN;
  //   const token1Address = BAT_TOKEN;
  //   const providerAddress = DAI_PROVIDER;

  //   let token0User;
  //   let token1User;

  //   before(async function() {
  //     this.token0 = await IToken.at(token0Address);
  //     this.token1 = await IToken.at(token1Address);
  //   });

  //   beforeEach(async function() {
  //     token0User = await this.token0.balanceOf.call(user);
  //     token1User = await this.token1.balanceOf.call(user);
  //   });

  //   describe('Exact input', function() {
  //     it('normal', async function() {

  //       let value = ether('1');
  //       const to = this.honeinch.address;

  //       const quoteReq = queryString.stringifyUrl({
  //         url: "https://api.1inch.exchange/v1.1/quote",
  //         query: {
  //           fromTokenAddress: this.token0.address,
  //           toTokenAddress: this.token1.address,
  //           amount: value,
  //         },
  //       });
  //       const swapReq = queryString.stringifyUrl({
  //         url: "https://api.1inch.exchange/v1.1/swap",
  //         query: {
  //           // fromTokenAddress: this.token0.address,
  //           // toTokenAddress: this.token1.address,
  //           fromTokenSymbol: "DAI",
  //           toTokenSymbol: "BAT",
  //           amount: value,
  //           slippage: 10,
  //           disableEstimate: false,
  //           fromAddress: providerAddress,
  //         },
  //       });
  //       console.log(`swapReq: ${swapReq}`);
        
  //       // const quoteReponse = await fetch(quoteReq);
  //       // const quoteData = await quoteReponse.json();
  //       // const quote = quoteData.toTokenAmount;
  //       // console.log(`quote = ${quote}`);
        
  //       // await this.token0.transfer(this.proxy.address, value, {
  //       //   from: providerAddress,
  //       // });
  //       // await this.proxy.updateTokenMock(this.token0.address);
        
  //       await this.token0.approve(ONEINCH_TOKEN_SPENDER, value, {
  //         from: providerAddress,
  //       });
  //       const swapReponse = await fetch(swapReq);
  //       const swapData = await swapReponse.json();
  //       const data = swapData.data;
  //       console.log(`swapData = ${JSON.stringify(swapData)}`);
  //       console.log(`proxy address = ${JSON.stringify(this.proxy.address)}`);
  //       console.log(`honeinch address = ${JSON.stringify(this.honeinch.address)}`);

  //       // const receipt = await this.proxy.execMock(to, data, { from: user, value: value });
  //       // const bal = await this.token1.balanceOf.call(user);
  //       // console.log(`bat balance: ${web3.utils.fromWei(bal)}`);

  //       // -------- send to h1inch contract -----------
  //       // await web3.eth.sendTransaction({
  //       //   from: swapData.from,
  //       //   to: this.honeinch.address,
  //       //   data: swapData.data,
  //       //   value: swapData.value,
  //       //   gas: swapData.gas,
  //       // });
  //       // const bal = await this.token1.balanceOf.call(this.honeinch.address);
  //       // console.log(`bat balance: ${web3.utils.fromWei(bal)}`);
  //       // --------------------------------------------

  //       // -------- send to 1inch contract -----------
  //       value = ether('100');

  //       await this.token0.transfer(user, value, {
  //         from: providerAddress,
  //       });
  //       const dai_be = await this.token0.balanceOf.call(user);
  //       console.log(`dai balance before: ${web3.utils.fromWei(dai_be)}`);

  //       await this.token0.approve(ONEINCH_TOKEN_SPENDER, value, {
  //         from: user,
  //       });
  //       const dai_allow = await this.token0.allowance.call(user, ONEINCH_TOKEN_SPENDER);
  //       console.log(`dai allowance: ${web3.utils.fromWei(dai_allow)}`);
  //       await this.token0.approve(ONEINCH_PROXY, value, {
  //         from: user,
  //       });
  //       const dai_allow_p = await this.token0.allowance.call(user, ONEINCH_PROXY);
  //       console.log(`dai allowance: ${web3.utils.fromWei(dai_allow_p)}`);
  //       console.log(`Token spender address: ${ONEINCH_TOKEN_SPENDER}`);
        
  //       await web3.eth.sendTransaction({
  //         from: swapData.from,
  //         to: swapData.to,
  //         data: swapData.data,
  //         value: swapData.value,
  //         gas: swapData.gas,
  //       });
  //       // await web3.eth.sendTransaction({
  //       //   from: swapData.from,
  //       //   to: this.honeinch.address,
  //       //   data: swapData.data.toString().substring(2),
  //       //   value: swapData.value,
  //       //   gas: swapData.gas,
  //       // });
  //       const bal = await this.token1.balanceOf.call(user);
  //       console.log(`bat balance: ${web3.utils.fromWei(bal)}`);
  //       // --------------------------------------------

  //       // expect(await this.token0.balanceOf.call(user)).to.be.bignumber.eq(
  //       //   token0User
  //       // );
  //       // expect(
  //       //   await this.token0.balanceOf.call(this.proxy.address)
  //       // ).to.be.bignumber.eq(ether('0'));
  //       // expect(
  //       //   await this.token1.balanceOf.call(this.proxy.address)
  //       // ).to.be.bignumber.eq(ether('0'));
  //       // expect(await this.token1.balanceOf.call(user)).to.be.bignumber.eq(
  //       //   token1User.add(result[result.length - 1])
  //       // );

  //       // profileGas(receipt);
  //     });
  //   });

  // });

  // describe('Token to Ether', function() {
  //   const tokenAddress = DAI_TOKEN;
  //   const providerAddress = DAI_PROVIDER;

  //   let balanceUser;
  //   let balanceProxy;
  //   let tokenUser;

  //   before(async function() {
  //     this.token = await IToken.at(tokenAddress);
  //   });

  //   beforeEach(async function() {
  //     balanceUser = await tracker(user);
  //     balanceProxy = await tracker(this.proxy.address);
  //     tokenUser = await this.token.balanceOf.call(user);
  //   });

  //   describe('Exact input', function() {
  //     it('normal', async function() {

  //       const value = ether('100');
  //       const to = this.honeinch.address;

  //       const quoteReq = queryString.stringifyUrl({
  //         url: "https://api.1inch.exchange/v1.1/quote",
  //         query: {
  //           fromTokenAddress: this.token.address,
  //           toTokenAddress: ETH_TOKEN,
  //           amount: value,
  //         },
  //       });
  //       const swapReq = queryString.stringifyUrl({
  //         url: "https://api.1inch.exchange/v1.1/swap",
  //         query: {
  //           // fromTokenAddress: ETH_TOKEN,
  //           // toTokenAddress: this.token.address,
  //           fromTokenSymbol: "DAI",
  //           toTokenSymbol: "ETH",
  //           amount: value,
  //           slippage: 1,
  //           disableEstimate: true,
  //           fromAddress: providerAddress,
  //         },
  //       });
  //       console.log(`swapReq: ${swapReq}`);
        
  //       const quoteReponse = await fetch(quoteReq);
  //       const quoteData = await quoteReponse.json();
  //       const quote = quoteData.toTokenAmount;
  //       console.log(`quote = ${quote}`);

  //       await this.token.transfer(this.proxy.address, value, {
  //         from: providerAddress
  //       });
  //       await this.proxy.updateTokenMock(this.token.address);
        
  //       const swapReponse = await fetch(swapReq);
  //       const swapData = await swapReponse.json();
  //       const data = swapData.data;
  //       console.log(`swapData = ${JSON.stringify(swapData)}`);
  //       console.log(`proxy address = ${JSON.stringify(this.proxy.address)}`);
  //       console.log(`honeinch address = ${JSON.stringify(this.honeinch.address)}`);

  //       const receipt = await this.proxy.execMock(to, data, { from: user });

  //       expect(await this.token.balanceOf.call(user)).to.be.bignumber.eq(
  //         tokenUser
  //       );
  //       expect(
  //         await this.token.balanceOf.call(this.proxy.address)
  //       ).to.be.bignumber.eq(ether('0'));
  //       expect(
  //         await balanceProxy.get()
  //       ).to.be.bignumber.eq(ether('0'));
  //       expect(await balanceUser.delta()).to.be.bignumber.gte(
  //         ether('0')
  //           .add(mulPercent(quote, 98))
  //           .sub(new BN(receipt.receipt.gasUsed))
  //       );

  //       profileGas(receipt);
  //     });
  //   });

  // });

  describe('Token to Token', function() {
    const token0Address = DAI_TOKEN;
    const token1Address = ZRX_TOKEN;
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

        // const value = (new BN(10)).mul(new BN(1000000));
        const value = ether('10');
        const to = this.honeinch.address;
        const slippage = 99;

        // const quoteReq = queryString.stringifyUrl({
        //   url: "https://api.1inch.exchange/v1.1/quote",
        //   query: {
        //     fromTokenAddress: this.token0.address,
        //     toTokenAddress: this.token1.address,
        //     amount: value,
        //   },
        // });
        const swapReq = queryString.stringifyUrl({
          url: "https://api.1inch.exchange/v1.1/swapQuote",
          query: {
            // fromTokenAddress: ETH_TOKEN,
            // toTokenAddress: this.token.address,
            fromTokenSymbol: "DAI",
            toTokenSymbol: "ZRX",
            amount: value,
            slippage: slippage,
            disableEstimate: true,
            fromAddress: providerAddress,
            disabledExchangesList: "0x Relays"
          },
        });
        console.log(`swapReq: ${swapReq}`);
        
        // const quoteReponse = await fetch(quoteReq);
        // const quoteData = await quoteReponse.json();
        // const quote = quoteData.toTokenAmount;
        // console.log(`quote = ${quote}`);

        await this.token0.transfer(this.proxy.address, value, {
          from: providerAddress
        });
        await this.proxy.updateTokenMock(this.token0.address);
        
        const swapReponse = await fetch(swapReq);
        const swapData = await swapReponse.json();
        const data = swapData.data;
        const quote = swapData.toTokenAmount;
        console.log(`quote = ${quote}`);
        console.log(`swapData = ${JSON.stringify(swapData)}`);
        console.log(`proxy address = ${JSON.stringify(this.proxy.address)}`);
        console.log(`honeinch address = ${JSON.stringify(this.honeinch.address)}`);

        const receipt = await this.proxy.execMock(to, data, { from: user });

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