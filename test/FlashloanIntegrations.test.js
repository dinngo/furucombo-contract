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
const util = require('ethereumjs-util');
const utils = web3.utils;

const { expect } = require('chai');

const {
  ETH_PROVIDER,
  ETH_TOKEN,
  DAI_TOKEN,
  DAI_UNISWAP,
  BAT_TOKEN,
  AAVEPROTOCOL_PROVIDER,
} = require('./utils/constants');
const { evmRevert, evmSnapshot, profileGas } = require('./utils/utils');

const HAave = artifacts.require('HAaveProtocol');
const HMock = artifacts.require('HMock');
const HUniswap = artifacts.require('HUniswap');
const Registry = artifacts.require('Registry');
const Proxy = artifacts.require('ProxyMock');
const IToken = artifacts.require('IERC20');
const ILendingPool = artifacts.require('ILendingPool');
const IProvider = artifacts.require('ILendingPoolAddressesProvider');
const IUniswapExchange = artifacts.require('IUniswapExchange');

contract('Aave flashloan', function([_, user]) {
  let id;
  let balanceUser;

  before(async function() {
    this.registry = await Registry.new();
    this.proxy = await Proxy.new(this.registry.address);
    this.hAave = await HAave.new();
    this.hMock = await HMock.new();
    await this.registry.register(
      this.hAave.address,
      utils.asciiToHex('Aave Protocol')
    );
    await this.registry.register(this.hMock.address, utils.asciiToHex('Mock'));
    this.provider = await IProvider.at(AAVEPROTOCOL_PROVIDER);
    const lendingPoolAddress = await this.provider.getLendingPool.call();
    const lendingPoolCoreAddress = await this.provider.getLendingPoolCore.call();
    this.lendingPool = await ILendingPool.at(lendingPoolAddress);
    await this.registry.register(lendingPoolAddress, this.hAave.address);
  });

  beforeEach(async function() {
    id = await evmSnapshot();
    balanceUser = await tracker(user);
  });

  afterEach(async function() {
    await evmRevert(id);
  });

  describe('Swap and Add liquidity', function() {
    const tokenAddress = DAI_TOKEN;
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

    it('Uniswap swap and add liquidity', async function() {
      const value = [ether('0.51'), ether('0.49')];
      const deadline = (await latest()).add(new BN('100'));
      const maxToken = await this.swap.ethToTokenSwapInput.call(
        new BN('1'),
        deadline,
        { from: user, value: value[0] }
      );
      const flashTo = [this.hUniswap.address, this.hUniswap.address];
      const flashData = [
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
      const flashTx = util.toBuffer(
        web3.eth.abi.encodeParameters(
          ['address[]', 'bytes[]'],
          [flashTo, flashData]
        )
      );
      const to = this.hAave.address;
      const data = abi.simpleEncode(
        'flashLoan(address,uint256,bytes)',
        ETH_TOKEN,
        value[0].add(value[1]).add(ether('0.1')),
        flashTx
      );

      const receipt = await this.proxy.execMock(to, data, {
        from: user,
        value: ether('1.1'),
      });
      expect(await balanceUser.delta()).to.be.bignumber.gt(
        ether('0')
          .sub(value[0])
          .sub(value[1])
          .sub(ether('0.1'))
          .sub(new BN(receipt.receipt.gasUsed))
      );
      expect(await this.swap.balanceOf.call(user)).to.be.bignumber.gt(
        ether('0')
      );
    });
  });
});
