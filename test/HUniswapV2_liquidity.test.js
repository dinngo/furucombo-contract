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
const {
  DAI_TOKEN,
  DAI_PROVIDER,
  ETH_PROVIDER,
  UNISWAPV2_ETH_DAI,
} = require('./utils/constants');
const { resetAccount, profileGas } = require('./utils/utils');

const HUniswapV2 = artifacts.require('HUniswapV2');
const Registry = artifacts.require('Registry');
const Proxy = artifacts.require('ProxyMock');
const IToken = artifacts.require('IERC20');

contract('UniswapV2 Liquidity', function([_, deployer, user]) {
  const tokenAddress = DAI_TOKEN;
  const providerAddress = DAI_PROVIDER;
  const uniswapV2ETHDAIAddress = UNISWAPV2_ETH_DAI;

  let balanceUser;
  let tokenUser;
  let uniTokenUser;

  before(async function() {
    this.registry = await Registry.new();
    this.proxy = await Proxy.new(this.registry.address);
    this.huniswapv2 = await HUniswapV2.new();
    await this.registry.register(
      this.huniswapv2.address,
      utils.asciiToHex('UniswapV2')
    );
    this.token = await IToken.at(tokenAddress);
    this.uniToken = await IToken.at(uniswapV2ETHDAIAddress);
    await this.token.transfer(user, ether('1000'), { from: providerAddress });
  });

  beforeEach(async function() {
    await resetAccount(_);
    await resetAccount(user);
    balanceUser = await tracker(user);
    tokenUser = await this.token.balanceOf.call(user);
    uniTokenUser = await this.uniToken.balanceOf.call(user);
  });

  describe('Add ETH', function() {
    beforeEach(async function() {
      await this.token.transfer(this.proxy.address, ether('100'), {
        from: user,
      });
      await this.proxy.updateTokenMock(this.token.address);
    });

    it('normal', async function() {
      const daiAmount = ether('0.002');
      const minDaiAmount = ether('0.000001');
      const minEthAmount = ether('0.000001');
      const value = ether('1');
      const to = this.huniswapv2.address;
      const data = abi.simpleEncode(
        'addLiquidityETH(uint256,address,uint256,uint256,uint256)',
        value,
        tokenAddress,
        daiAmount,
        minDaiAmount,
        minEthAmount
      );

      const receipt = await this.proxy.execMock(to, data, {
        from: user,
        value: value,
      });

      // Check spent ether
      expect(await balanceUser.delta()).to.be.bignumber.lt(
        ether('0')
          .sub(minEthAmount)
          .sub(new BN(receipt.receipt.gasUsed))
      );

      // Check spent token
      expect(await this.token.balanceOf.call(user)).to.be.bignumber.lt(
        tokenUser.sub(minDaiAmount)
      );

      // TODO: Find out the exact number of uniToken for testing
      expect(await this.uniToken.balanceOf.call(user)).to.be.bignumber.gt(
        uniTokenUser
      );
      profileGas(receipt);
    });
  });
});
