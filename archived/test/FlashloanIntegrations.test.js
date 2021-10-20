const {
  balance,
  BN,
  constants,
  ether,
  time,
} = require('@openzeppelin/test-helpers');
const { tracker } = balance;
const { ZERO_BYTES32 } = constants;
const { latest } = time;
const abi = require('ethereumjs-abi');
const util = require('ethereumjs-util');
const utils = web3.utils;

const { expect } = require('chai');

const {
  ETH_TOKEN,
  WETH_TOKEN,
  DAI_TOKEN,
  DAI_UNISWAP,
  AAVEPROTOCOL_PROVIDER,
  UNISWAPV2_ROUTER02,
} = require('./utils/constants');
const { evmRevert, evmSnapshot, profileGas } = require('./utils/utils');

const HAave = artifacts.require('HAaveProtocol');
const HMock = artifacts.require('HMock');
const HUniswapV2 = artifacts.require('HUniswapV2');
const Registry = artifacts.require('Registry');
const Proxy = artifacts.require('ProxyMock');
const IToken = artifacts.require('IERC20');
const ILendingPool = artifacts.require('ILendingPool');
const IProvider = artifacts.require('ILendingPoolAddressesProvider');
const IUniswapV2Router = artifacts.require('IUniswapV2Router02');

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
    this.lendingPool = await ILendingPool.at(lendingPoolAddress);
    await this.registry.registerCaller(lendingPoolAddress, this.hAave.address);
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

    before(async function() {
      this.hUniswap = await HUniswapV2.new();
      await this.registry.register(
        this.hUniswap.address,
        utils.asciiToHex('Uniswap V2')
      );
      this.token = await IToken.at(tokenAddress);
      this.router = await IUniswapV2Router.at(UNISWAPV2_ROUTER02);
    });

    it('Uniswap swap and add liquidity', async function() {
      const value = [ether('0.51'), ether('0.49')];
      const minTokenAmount = ether('0.0000001');
      const minEthAmount = ether('0.0000001');
      const path = [WETH_TOKEN, tokenAddress];
      const deadline = (await latest()).add(new BN('100'));
      const retUniV2 = await this.router.getAmountsOut.call(value[0], path, {
        from: user,
      });
      const maxToken = retUniV2[1];
      const flashTo = [this.hUniswap.address, this.hUniswap.address];
      const flashConfig = [ZERO_BYTES32, ZERO_BYTES32];
      const flashData = [
        abi.simpleEncode(
          'swapExactETHForTokens(uint256,uint256,address[]):(uint256[])',
          value[0],
          new BN('1'),
          path
        ),
        abi.simpleEncode(
          'addLiquidityETH(uint256,address,uint256,uint256,uint256):(uint256,uint256,uint256)',
          value[1],
          tokenAddress,
          maxToken,
          minTokenAmount,
          minEthAmount
        ),
      ];
      const flashTx = util.toBuffer(
        web3.eth.abi.encodeParameters(
          ['address[]', 'bytes32[]', 'bytes[]'],
          [flashTo, flashConfig, flashData]
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
    });
  });
});
