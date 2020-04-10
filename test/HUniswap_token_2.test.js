const {
  balance,
  BN,
  constants,
  ether,
  expectEvent,
  expectRevert,
  time
} = require('@openzeppelin/test-helpers');
const { MAX_UINT256 } = constants;
const { tracker } = balance;
const { latest } = time;
const abi = require('ethereumjs-abi');
const utils = web3.utils;

const { expect } = require('chai');

const {
  DAI_TOKEN,
  DAI_UNISWAP,
  DAI_PROVIDER,
  BAT_TOKEN
} = require('./utils/constants');
const { resetAccount } = require('./utils/utils');

const HUniswap = artifacts.require('HUniswap_3');
const Registry = artifacts.require('Registry');
const Proxy = artifacts.require('ProxyMock');
const IToken = artifacts.require('IERC20');
const IUniswapExchange = artifacts.require('IUniswapExchange');

contract('Swap', function([_, deployer, user1, user2, someone]) {
  const token0Address = DAI_TOKEN;
  const token1Address = BAT_TOKEN;
  const uniswapAddress = DAI_UNISWAP;
  const providerAddress = DAI_PROVIDER;

  beforeEach(async function() {
    await resetAccount(_);
    await resetAccount(user1);
    await resetAccount(user2);
  });

  before(async function() {
    this.registry = await Registry.new();
    this.proxy = await Proxy.new(this.registry.address);
    this.huniswap = await HUniswap.new();
    await this.registry.register(
      this.huniswap.address,
      utils.asciiToHex('Uniswap')
    );
    this.token0 = await IToken.at(token0Address);
    this.token1 = await IToken.at(token1Address);
    this.swap = await IUniswapExchange.at(uniswapAddress);
  });

  describe('Exact input', function() {
    it('normal', async function() {
      const value = [ether('100')];
      const to = [this.huniswap.address];
      const data = [
        abi.simpleEncode(
          'tokenToTokenSwapInput(address,uint256,uint256,address):(uint256)',
          token0Address,
          value[0],
          new BN('1'),
          token1Address
        )
      ];
      await this.token0.transfer(this.proxy.address, value[0], {
        from: providerAddress
      });
      await this.token0.transfer(someone, value[0], { from: providerAddress });
      await this.token0.approve(this.swap.address, value[0], { from: someone });

      const deadline = (await latest()).add(new BN('100'));
      const result = await this.swap.tokenToTokenSwapInput.call(
        value[0],
        new BN('1'),
        new BN('1'),
        deadline,
        token1Address,
        { from: someone }
      );
      const receipt = await this.proxy.batchExec(to, data, { from: user1 });

      expect(await this.token0.balanceOf.call(user1)).to.be.bignumber.eq(
        ether('0')
      );
      expect(
        await this.token0.balanceOf.call(this.proxy.address)
      ).to.be.bignumber.eq(ether('0'));
      expect(await this.token1.balanceOf.call(user1)).to.be.bignumber.eq(
        result
      );
    });
  });

  describe('Exact output', function() {
    it('normal', async function() {
      const value = [ether('100')];
      const to = [this.huniswap.address];
      const data = [
        abi.simpleEncode(
          'tokenToTokenSwapOutput(address,uint256,uint256,address):(uint256)',
          token0Address,
          value[0],
          value[0],
          token1Address
        )
      ];
      await this.token0.transfer(this.proxy.address, value[0], {
        from: providerAddress
      });
      await this.proxy.updateTokenMock(this.token0.address);
      await this.token0.transfer(someone, value[0], { from: providerAddress });
      await this.token0.approve(this.swap.address, value[0], { from: someone });

      const deadline = (await latest()).add(new BN('100'));
      const result = await this.swap.tokenToTokenSwapOutput.call(
        value[0],
        value[0],
        MAX_UINT256,
        deadline,
        token1Address,
        { from: someone }
      );
      const receipt = await this.proxy.execMock(to[0], data[0], {
        from: user2
      });
      expect(await this.token0.balanceOf.call(user2)).to.be.bignumber.eq(
        value[0].sub(result)
      );
      expect(
        await this.token0.balanceOf.call(this.proxy.address)
      ).to.be.bignumber.eq(ether('0'));
      expect(await this.token1.balanceOf.call(user2)).to.be.bignumber.eq(
        value[0]
      );
    });
  });
});
