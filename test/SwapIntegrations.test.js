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
const { latest } = time;
const abi = require('ethereumjs-abi');
const utils = web3.utils;

const { expect } = require('chai');

const { DAI_TOKEN, DAI_UNISWAP, CDAI } = require('./utils/constants');
const { evmRevert, evmSnapshot, profileGas } = require('./utils/utils');

const HUniswap = artifacts.require('HUniswap');
const HCToken = artifacts.require('HCToken');
const Registry = artifacts.require('Registry');
const Proxy = artifacts.require('Proxy');
const IToken = artifacts.require('IERC20');
const ICToken = artifacts.require('ICToken');
const IUniswapExchange = artifacts.require('IUniswapExchange');

contract('SwapIntegration', function([_, user]) {
  const tokenAddress = DAI_TOKEN;

  let id;
  let balanceUser;
  let balanceProxy;

  before(async function() {
    this.registry = await Registry.new();
    this.proxy = await Proxy.new(this.registry.address);
  });

  beforeEach(async function() {
    id = await evmSnapshot();
    balanceUser = await tracker(user);
    balanceProxy = await tracker(this.proxy.address);
  });

  afterEach(async function() {
    await evmRevert(id);
  });

  describe('Uniswap Swap', function() {
    const uniswapAddress = DAI_UNISWAP;

    before(async function() {
      this.hUniswap = await HUniswap.new();
      await this.registry.register(
        this.hUniswap.address,
        utils.asciiToHex('Uniswap')
      );
      this.token = await IToken.at(tokenAddress);
      this.swap = await IUniswapExchange.at(uniswapAddress);
    });

    describe('Uniswap Addliquidity', function() {
      it('normal', async function() {
        const value = [ether('0.51'), ether('0.49')];
        const deadline = (await latest()).add(new BN('100'));
        const maxToken = await this.swap.ethToTokenSwapInput.call(
          new BN('1'),
          deadline,
          { from: user, value: value[0] }
        );
        const to = [this.hUniswap.address, this.hUniswap.address];
        const data = [
          abi.simpleEncode(
            'ethToTokenSwapInput(uint256,address,uint256):(uint256)',
            value[0],
            tokenAddress,
            new BN('1')
          ),
          abi.simpleEncode(
            'addLiquidity(uint256,address,uint256):(uint256)',
            value[1],
            tokenAddress,
            maxToken
          ),
        ];
        const receipt = await this.proxy.batchExec(to, data, {
          from: user,
          value: ether('1'),
        });
        expect(await balanceUser.delta()).to.be.bignumber.eq(
          ether('0')
            .sub(value[0])
            .sub(value[1])
            .sub(new BN(receipt.receipt.gasUsed))
        );
        expect(await this.swap.balanceOf.call(user)).to.be.bignumber.gt(
          ether('0')
        );
      });
    });

    describe('Compound Token Lending', function() {
      const cTokenAddress = CDAI;

      before(async function() {
        this.hCToken = await HCToken.new();
        await this.registry.register(
          this.hCToken.address,
          utils.asciiToHex('CToken')
        );
        this.cToken = await ICToken.at(cTokenAddress);
      });

      it('normal', async function() {
        let value = [ether('0.1'), ether('0')];
        const deadline = (await latest()).add(new BN('100'));
        value[1] = await this.swap.ethToTokenSwapInput.call(
          new BN('1'),
          deadline,
          { from: user, value: value[0] }
        );
        const to = [this.hUniswap.address, this.hCToken.address];
        const data = [
          abi.simpleEncode(
            'ethToTokenSwapInput(uint256,address,uint256):(uint256)',
            value[0],
            tokenAddress,
            new BN('1')
          ),
          abi.simpleEncode('mint(address,uint256)', cTokenAddress, value[1]),
        ];
        const rate = await this.cToken.exchangeRateStored.call();
        const result = value[1].mul(ether('1')).div(rate);
        const receipt = await this.proxy.batchExec(to, data, {
          from: user,
          value: ether('1'),
        });
        const cTokenUser = await this.cToken.balanceOf.call(user);
        expect(
          cTokenUser.mul(new BN('1000')).divRound(result)
        ).to.be.bignumber.eq(new BN('1000'));
      });
    });
  });
});
