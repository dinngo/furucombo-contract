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
const { ZERO_BYTES32 } = constants;
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
const Foo = artifacts.require('Foo4');
const FooHandler = artifacts.require('Foo4Handler');

contract('CubeCounting', function([_, user]) {
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
      this.foo = await Foo.new();
      this.fooHandler = await FooHandler.new();
      await this.registry.register(
        this.fooHandler.address,
        utils.asciiToHex('Foo')
      );
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

      it('revert on 1st cube', async function() {
        let value = [ether('10'), ether('0')];
        const deadline = (await latest()).add(new BN('100'));
        value[1] = await this.swap.ethToTokenSwapInput.call(
          new BN('1'),
          deadline,
          { from: user, value: value[0] }
        );
        const to = [this.hUniswap.address, this.hCToken.address];
        const config = [ZERO_BYTES32, ZERO_BYTES32];
        const data = [
          abi.simpleEncode(
            'ethToTokenSwapInput(uint256,address,uint256):(uint256)',
            value[0],
            tokenAddress,
            new BN('1')
          ),
          abi.simpleEncode(
            'mint(address,uint256)',
            cTokenAddress,
            value[1].add(ether('10'))
          ),
        ];
        const rate = await this.cToken.exchangeRateStored.call();
        const result = value[1].mul(ether('1')).div(rate);
        await expectRevert(
          this.proxy.batchExec(to, config, data, {
            from: user,
            value: ether('1'),
          }),
          '1_HUniswap_ethToTokenSwapInput: Unspecified'
        );
      });

      it('revert on 2nd cube', async function() {
        let value = [ether('0.1'), ether('0')];
        const deadline = (await latest()).add(new BN('100'));
        value[1] = await this.swap.ethToTokenSwapInput.call(
          new BN('1'),
          deadline,
          { from: user, value: value[0] }
        );
        const to = [this.hUniswap.address, this.hCToken.address];
        const config = [ZERO_BYTES32, ZERO_BYTES32];
        const data = [
          abi.simpleEncode(
            'ethToTokenSwapInput(uint256,address,uint256):(uint256)',
            value[0],
            tokenAddress,
            new BN('1')
          ),
          abi.simpleEncode(
            'mint(address,uint256)',
            cTokenAddress,
            value[1].add(ether('10'))
          ),
        ];
        const rate = await this.cToken.exchangeRateStored.call();
        const result = value[1].mul(ether('1')).div(rate);
        await expectRevert(
          this.proxy.batchExec(to, config, data, {
            from: user,
            value: ether('1'),
          }),
          '2_HCToken_mint: error 13'
        );
      });

      it('revert on 3rd cube', async function() {
        let value = [ether('0.1'), ether('0')];
        const deadline = (await latest()).add(new BN('100'));
        value[1] = await this.swap.ethToTokenSwapInput.call(
          new BN('1'),
          deadline,
          { from: user, value: value[0] }
        );
        const to = [
          this.hUniswap.address,
          this.fooHandler.address,
          this.hCToken.address,
        ];
        const config = [ZERO_BYTES32, ZERO_BYTES32, ZERO_BYTES32];
        const data = [
          abi.simpleEncode(
            'ethToTokenSwapInput(uint256,address,uint256):(uint256)',
            value[0],
            tokenAddress,
            new BN('1')
          ),
          abi.simpleEncode('bar(address)', this.foo.address),
          abi.simpleEncode(
            'mint(address,uint256)',
            cTokenAddress,
            value[1].add(ether('10'))
          ),
        ];
        const rate = await this.cToken.exchangeRateStored.call();
        const result = value[1].mul(ether('1')).div(rate);
        await expectRevert(
          this.proxy.batchExec(to, config, data, {
            from: user,
            value: ether('1'),
          }),
          '3_HCToken_mint: error 13'
        );
      });
    });
  });
});
