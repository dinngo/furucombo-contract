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
  DAI_UNISWAP,
  DAI_PROVIDER,
  ETH_PROVIDER,
} = require('./utils/constants');
const {
  evmRevert,
  evmSnapshot,
  profileGas,
  getHandlerReturn,
} = require('./utils/utils');

const HUniswap = artifacts.require('HUniswap');
const Registry = artifacts.require('Registry');
const Proxy = artifacts.require('ProxyMock');
const IToken = artifacts.require('IERC20');
const IUniswapExchange = artifacts.require('IUniswapExchange');

contract('Uniswap Liquidity', function([_, user]) {
  const tokenAddress = DAI_TOKEN;
  const uniswapAddress = DAI_UNISWAP;
  const providerAddress = DAI_PROVIDER;

  let id;
  let balanceUser;
  let tokenUser;
  let uniTokenUser;

  before(async function() {
    this.registry = await Registry.new();
    this.proxy = await Proxy.new(this.registry.address);
    this.hUniswap = await HUniswap.new();
    await this.registry.register(
      this.hUniswap.address,
      utils.asciiToHex('Uniswap')
    );
    this.token = await IToken.at(tokenAddress);
    this.swap = await IUniswapExchange.at(uniswapAddress);
    await this.token.transfer(user, ether('1000'), { from: providerAddress });
  });

  beforeEach(async function() {
    id = await evmSnapshot();
    balanceUser = await tracker(user);
    tokenUser = await this.token.balanceOf.call(user);
    uniTokenUser = await this.swap.balanceOf.call(user);
  });

  afterEach(async function() {
    await evmRevert(id);
  });

  describe('Add', function() {
    beforeEach(async function() {
      await this.token.transfer(this.proxy.address, ether('100'), {
        from: user,
      });
      await this.proxy.updateTokenMock(this.token.address);
    });

    it('normal', async function() {
      const value = ether('0.01');
      const to = this.hUniswap.address;
      const data = abi.simpleEncode(
        'addLiquidity(uint256,address,uint256):(uint256)',
        value,
        tokenAddress,
        ether('100')
      );
      const deadline = (await latest()).add(new BN('100'));
      await this.token.approve(this.swap.address, ether('1000'), {
        from: user,
      });
      const result = await this.swap.addLiquidity.call(
        new BN('1'),
        ether('100'),
        deadline,
        { from: user, value: value }
      );
      const receipt = await this.proxy.execMock(to, data, {
        from: user,
        value: value,
      });

      const handlerReturn = utils.toBN(
        getHandlerReturn(receipt, ['uint256'])[0]
      );
      expect(handlerReturn).to.be.bignumber.eq(result);

      expect(await balanceUser.delta()).to.be.bignumber.lt(ether('0'));
      expect(await this.swap.balanceOf.call(user)).to.be.bignumber.eq(
        uniTokenUser.add(result)
      );
      profileGas(receipt);
    });
  });

  describe('Remove', function() {
    let deadline;

    beforeEach(async function() {
      await this.token.transfer(user, ether('100'), { from: providerAddress });
      await this.token.approve(this.swap.address, ether('1000'), {
        from: user,
      });
      deadline = (await latest()).add(new BN('100'));
      await this.swap.addLiquidity(new BN('1'), ether('100'), deadline, {
        from: user,
        value: ether('0.01'),
      });
      tokenUser = await this.token.balanceOf.call(user);
      uniTokenUser = await this.swap.balanceOf.call(user);
    });

    it('normal', async function() {
      const value = uniTokenUser;
      const to = this.hUniswap.address;
      const data = abi.simpleEncode(
        'removeLiquidity(address,uint256,uint256,uint256):(uint256,uint256)',
        tokenAddress,
        value,
        new BN('1'),
        new BN('1')
      );
      await this.swap.approve(this.swap.address, uniTokenUser, {
        from: user,
      });
      const result = await this.swap.removeLiquidity.call(
        uniTokenUser,
        new BN('1'),
        new BN('1'),
        deadline,
        { from: user }
      );
      await this.swap.transfer(this.proxy.address, uniTokenUser, {
        from: user,
      });
      await this.proxy.updateTokenMock(this.swap.address);
      await balanceUser.get();
      const receipt = await this.proxy.execMock(to, data, { from: user });

      const handlerReturn = getHandlerReturn(receipt, ['uint256', 'uint256']);
      const userBalanceDelta = await balanceUser.delta();

      expect(userBalanceDelta).to.be.bignumber.eq(
        utils.toBN(handlerReturn[0]).sub(new BN(receipt.receipt.gasUsed))
      );
      expect(utils.toBN(handlerReturn[1])).to.be.bignumber.eq(result['1']);

      expect(await this.token.balanceOf.call(user)).to.be.bignumber.eq(
        tokenUser.add(result['1'])
      );
      expect(userBalanceDelta).to.be.bignumber.eq(
        result['0'].sub(new BN(receipt.receipt.gasUsed))
      );
      profileGas(receipt);
    });
  });
});
