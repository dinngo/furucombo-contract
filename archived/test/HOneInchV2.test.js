const { balance, BN, ether } = require('@openzeppelin/test-helpers');
const { tracker } = balance;
const utils = web3.utils;
const { expect } = require('chai');
const {
  DAI_TOKEN,
  DAI_SYMBOL,
  USDC_TOKEN,
  USDC_SYMBOL,
} = require('./utils/constants');
const {
  evmRevert,
  evmSnapshot,
  mulPercent,
  profileGas,
  getHandlerReturn,
  tokenProviderUniV2,
} = require('./utils/utils');
const fetch = require('node-fetch');
const queryString = require('query-string');

const HOneInchExchange = artifacts.require('HOneInchExchange');
const FeeRuleRegistry = artifacts.require('FeeRuleRegistry');
const Registry = artifacts.require('Registry');
const Proxy = artifacts.require('ProxyMock');
const IToken = artifacts.require('IERC20');

// const PROTOCOLS = ["PMMX","UNIFI","SHIBASWAP","CLIPPER","DXSWAP","FIXED_FEE_SWAP","DFX_FINANCE","CONVERGENCE_X","SAKESWAP","CREAM_LENDING","DODO_V2","CURVE_V2","SETH_WRAPPER","WETH","MOONISWAP","SUSHI","COMPOUND","KYBER","CREAMSWAP","AAVE","CURVE","UNISWAP_V1","BALANCER","CHAI","OASIS","BANCOR","IEARN","SWERVE","VALUELIQUID","DODO","SHELL","BLACKHOLESWAP","PMM1","DEFISWAP","LUASWAP","MINISWAP","MSTABLE","AAVE_LIQUIDATOR","SYNTHETIX","AAVE_V2","ST_ETH","ONE_INCH_LP","LINKSWAP","S_FINANCE","ONE_INCH_LP_1_1","PSM","ONE_INCH_LP_MIGRATOR_V1_1","UNISWAP_V2_MIGRATOR","SUSHISWAP_MIGRATOR","ONE_INCH_LP_MIGRATOR","POWERINDEX","INDEXED_FINANCE","XSIGMA","SMOOTHY_FINANCE","PMM2","PMM3","SADDLE","PMM4","KYBER_DMM","BALANCER_V2","UNISWAP_V3"].join(',');
const PROTOCOLS = ['PMMX', 'CURVE_V2', 'UNISWAP_V3'].join(',');

contract('OneInch Swap', function([_, user]) {
  let id;

  before(async function() {
    this.registry = await Registry.new();
    this.hOneInchV2 = await HOneInchExchange.new();
    await this.registry.register(
      this.hOneInchV2.address,
      utils.asciiToHex('OneInch V2')
    );
    this.feeRuleRegistry = await FeeRuleRegistry.new('0', _);
    this.proxy = await Proxy.new(this.registry.address, this.feeRuleRegistry.address);
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
        const value = ether('0.1');
        const to = this.hOneInchV2.address;
        const slippage = 3;

        const swapReq = queryString.stringifyUrl({
          url: 'https://api.1inch.exchange/v2.0/swap',
          query: {
            fromTokenAddress: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
            toTokenAddress: tokenAddress,
            amount: value,
            slippage: slippage,
            disableEstimate: true,
            fromAddress: this.proxy.address,
            protocols: PROTOCOLS,
          },
        });

        const swapResponse = await fetch(swapReq);
        const swapData = await swapResponse.json();
        const data = swapData.tx.data;
        const quote = swapData.toTokenAmount;
        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: value,
        });

        const tokenUserEnd = await this.token.balanceOf.call(user);
        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );
        expect(handlerReturn).to.be.bignumber.eq(tokenUserEnd.sub(tokenUser));

        expect(tokenUserEnd).to.be.bignumber.gte(
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
        const value = ether('0.1');
        const to = this.hOneInchV2.address;
        const slippage = 3;

        const swapReq = queryString.stringifyUrl({
          url: 'https://api.1inch.exchange/v2.0/swap',
          query: {
            fromTokenAddress: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
            toTokenAddress: tokenAddress,
            amount: value,
            slippage: slippage,
            disableEstimate: true,
            fromAddress: this.proxy.address,
            protocols: PROTOCOLS,
          },
        });

        const swapResponse = await fetch(swapReq);
        const swapData = await swapResponse.json();
        const data = swapData.tx.data;
        const quote = swapData.toTokenAmount;
        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: value.add(ether('1')),
        });

        const tokenUserEnd = await this.token.balanceOf.call(user);
        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );
        expect(handlerReturn).to.be.bignumber.eq(tokenUserEnd.sub(tokenUser));

        expect(tokenUserEnd).to.be.bignumber.gte(
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

    let balanceUser;
    let balanceProxy;
    let tokenUser;
    let providerAddress;

    before(async function() {
      providerAddress = await tokenProviderUniV2(tokenAddress);

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
        const to = this.hOneInchV2.address;
        const slippage = 3;

        const swapReq = queryString.stringifyUrl({
          url: 'https://api.1inch.exchange/v2.0/swap',
          query: {
            fromTokenAddress: tokenAddress,
            toTokenAddress: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
            amount: value,
            slippage: slippage,
            disableEstimate: true,
            fromAddress: this.proxy.address,
            protocols: PROTOCOLS,
          },
        });

        await this.token.transfer(this.proxy.address, value, {
          from: providerAddress,
        });
        await this.proxy.updateTokenMock(this.token.address);

        const swapResponse = await fetch(swapReq);
        const swapData = await swapResponse.json();
        const data = swapData.tx.data;
        const quote = swapData.toTokenAmount;
        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: ether('0.1'),
        });

        const balanceUserDelta = await balanceUser.delta();

        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );
        expect(handlerReturn).to.be.bignumber.eq(
          balanceUserDelta.add(new BN(receipt.receipt.gasUsed))
        );

        expect(await this.token.balanceOf.call(user)).to.be.bignumber.eq(
          tokenUser
        );
        expect(
          await this.token.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.eq(ether('0'));
        expect(await balanceProxy.get()).to.be.bignumber.eq(ether('0'));
        expect(balanceUserDelta).to.be.bignumber.gte(
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
    const token1Address = USDC_TOKEN;

    let token0User;
    let token1User;
    let providerAddress;

    before(async function() {
      providerAddress = await tokenProviderUniV2(token0Address);

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
        const to = this.hOneInchV2.address;
        const slippage = 3;

        const swapReq = queryString.stringifyUrl({
          url: 'https://api.1inch.exchange/v2.0/swap',
          query: {
            fromTokenAddress: token0Address,
            toTokenAddress: token1Address,
            amount: value,
            slippage: slippage,
            disableEstimate: true,
            fromAddress: this.proxy.address,
            protocols: PROTOCOLS,
          },
        });

        await this.token0.transfer(this.proxy.address, value, {
          from: providerAddress,
        });
        await this.proxy.updateTokenMock(this.token0.address);

        const swapResponse = await fetch(swapReq);
        const swapData = await swapResponse.json();
        const data = swapData.tx.data;
        const quote = swapData.toTokenAmount;
        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: ether('0.1'),
        });

        const token1UserEnd = await this.token1.balanceOf.call(user);
        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );
        expect(handlerReturn).to.be.bignumber.eq(token1UserEnd.sub(token1User));

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
