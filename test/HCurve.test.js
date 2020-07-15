const { BN, ether } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');
const abi = require('ethereumjs-abi');
const utils = web3.utils;
const {
  DAI_TOKEN,
  USDT_TOKEN,
  TUSD_TOKEN,
  SUSD_TOKEN,
  WBTC_TOKEN,
  RENBTC_TOKEN,
  USDT_PROVIDER,
  SUSD_PROVIDER,
  WBTC_PROVIDER,
  CURVE_Y_SWAP,
  CURVE_SBTC_SWAP,
  CURVE_ONE_SPLIT,
} = require('./utils/constants');
const { resetAccount, profileGas } = require('./utils/utils');

const Proxy = artifacts.require('ProxyMock');
const Registry = artifacts.require('Registry');
const HCurve = artifacts.require('HCurve');
const ICurveSwap = artifacts.require('ICurveSwap');
const IOneSplit = artifacts.require('IOneSplit');
const IToken = artifacts.require('IERC20');

contract('Curve Swap', function([_, deployer, user]) {
  before(async function() {
    this.registry = await Registry.new();
    this.hcurve = await HCurve.new();
    await this.registry.register(
      this.hcurve.address,
      utils.asciiToHex('HCurve')
    );
    this.yswap = await ICurveSwap.at(CURVE_Y_SWAP);
    this.sbtcswap = await ICurveSwap.at(CURVE_SBTC_SWAP);
    this.onesplit = await IOneSplit.at(CURVE_ONE_SPLIT);
  });

  beforeEach(async function() {
    await resetAccount(_);
    await resetAccount(user);
    this.proxy = await Proxy.new(this.registry.address);
  });

  describe('Swap USDT to DAI', function() {
    const token0Address = USDT_TOKEN;
    const token1Address = DAI_TOKEN;
    const providerAddress = USDT_PROVIDER;

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

    describe('Exact input through y pool', function() {
      it('normal', async function() {
        const value = new BN('1000000');
        const answer = await this.yswap.get_dy_underlying.call(2, 0, value, {
          from: user,
        });
        const data = abi.simpleEncode(
          'exchangeUnderlying(address,int128,int128,uint256,uint256)',
          this.yswap.address,
          2,
          0,
          value,
          new BN('1')
        );
        await this.token0.transfer(this.proxy.address, value, {
          from: providerAddress,
        });
        await this.proxy.updateTokenMock(this.token0.address);
        const receipt = await this.proxy.execMock(this.hcurve.address, data, {
          from: user,
        });
        expect(
          await this.token0.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.eq(ether('0'));
        expect(
          await this.token1.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.eq(ether('0'));
        expect(await this.token0.balanceOf.call(user)).to.be.bignumber.eq(
          token0User
        );
        // get_dy_underlying flow is different from exchange_underlying,
        // so give 1*10^12 tolerance for USDT/DAI case.
        expect(await this.token1.balanceOf.call(user)).to.be.bignumber.gte(
          token1User.add(answer).sub(new BN('1000000000000'))
        );
        expect(await this.token1.balanceOf.call(user)).to.be.bignumber.lte(
          token1User.add(answer)
        );
        profileGas(receipt);
      });
    });
  });

  describe('Swap WBTC to renBTC', function() {
    const token0Address = WBTC_TOKEN;
    const token1Address = RENBTC_TOKEN;
    const providerAddress = WBTC_PROVIDER;

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

    describe('Exact input through sBTC pool', function() {
      it('normal', async function() {
        const value = new BN('100000000');
        const answer = await this.sbtcswap.get_dy.call(1, 0, value, {
          from: user,
        });
        const data = abi.simpleEncode(
          'exchange(address,int128,int128,uint256,uint256)',
          this.sbtcswap.address,
          1,
          0,
          value,
          new BN('1')
        );
        await this.token0.transfer(this.proxy.address, value, {
          from: providerAddress,
        });
        await this.proxy.updateTokenMock(this.token0.address);
        const receipt = await this.proxy.execMock(this.hcurve.address, data, {
          from: user,
        });
        expect(
          await this.token0.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.eq(ether('0'));
        expect(
          await this.token1.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.eq(ether('0'));
        expect(await this.token0.balanceOf.call(user)).to.be.bignumber.eq(
          token0User
        );
        // get_dy flow is different from exchange,
        // so give 1 wei tolerance for WBTC/renBTC case.
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

  describe('Swap sUSD to TUSD', function() {
    const token0Address = SUSD_TOKEN;
    const token1Address = TUSD_TOKEN;
    const providerAddress = SUSD_PROVIDER;

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

    describe('Exact input through onesplit (susd to y pool)', function() {
      it('normal', async function() {
        const value = ether('1');
        const parts = new BN('2');
        const flags = 0x401e006d000;
        const answer = await this.onesplit.getExpectedReturn.call(
          this.token0.address,
          this.token1.address,
          value,
          parts,
          flags,
          {
            from: user,
          }
        );
        const data = abi.simpleEncode(
          'swap(address,address,uint256,uint256,uint256[],uint256)',
          this.token0.address,
          this.token1.address,
          value,
          new BN('1'),
          answer.distribution,
          flags
        );
        await this.token0.transfer(this.proxy.address, value, {
          from: providerAddress,
        });
        proxyb = await this.token0.balanceOf.call(this.proxy.address);
        await this.proxy.updateTokenMock(this.token0.address);
        const receipt = await this.proxy.execMock(this.hcurve.address, data, {
          from: user,
        });
        expect(
          await this.token0.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.eq(ether('0'));
        expect(
          await this.token1.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.eq(ether('0'));
        expect(await this.token0.balanceOf.call(user)).to.be.bignumber.eq(
          token0User
        );
        // oneSplit use sUSD and y pools in this case, give 1*10^18 tolerance
        // for sUSD/TUSD.
        expect(await this.token1.balanceOf.call(user)).to.be.bignumber.gte(
          token1User.add(answer.returnAmount).sub(ether('1'))
        );
        expect(await this.token1.balanceOf.call(user)).to.be.bignumber.lte(
          token1User.add(answer.returnAmount)
        );
        profileGas(receipt);
      });
    });
  });
});
