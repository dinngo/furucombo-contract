const { balance, BN, constants, ether } = require('@openzeppelin/test-helpers');
const { tracker } = balance;
const { ZERO_BYTES32 } = constants;
const abi = require('ethereumjs-abi');
const utils = web3.utils;

const { expect } = require('chai');

const {
  DAI_TOKEN,
  WETH_TOKEN,
  UNISWAPV2_ROUTER02,
  MAKER_CDP_MANAGER,
  MAKER_PROXY_ACTIONS,
  MAKER_PROXY_REGISTRY,
  MAKER_MCD_VAT,
  MAKER_MCD_JOIN_ETH_A,
  MAKER_MCD_JOIN_DAI,
} = require('./utils/constants');
const { evmRevert, evmSnapshot, tokenProviderUniV2 } = require('./utils/utils');

const HMaker = artifacts.require('HMaker');
const HUniswapV2 = artifacts.require('HUniswapV2');
const FeeRuleRegistry = artifacts.require('FeeRuleRegistry');
const Registry = artifacts.require('Registry');
const Proxy = artifacts.require('ProxyMock');
const IToken = artifacts.require('IERC20');
const IDSProxy = artifacts.require('IDSProxy');
const IDSProxyRegistry = artifacts.require('IDSProxyRegistry');
const IMakerManager = artifacts.require('IMakerManager');
const IMakerVat = artifacts.require('IMakerVat');
const IUniswapV2Router = artifacts.require('IUniswapV2Router02');

async function getGenerateLimitAndMinCollateral(ilk) {
  const vat = await IMakerVat.at(MAKER_MCD_VAT);
  const conf = await vat.ilks.call(ilk);
  const generateLimit = conf[4].div(ether('1000000000'));
  const minCollateral = conf[4]
    .div(conf[2])
    .mul(new BN('12'))
    .div(new BN('10'));
  return [generateLimit, minCollateral];
}

async function approveCdp(cdp, owner, user) {
  const registry = await IDSProxyRegistry.at(MAKER_PROXY_REGISTRY);
  const proxyAddress = await registry.proxies.call(owner);
  const proxy = await IDSProxy.at(proxyAddress);
  const data = abi.simpleEncode(
    'cdpAllow(address,uint256,address,uint256)',
    MAKER_CDP_MANAGER,
    cdp,
    user,
    new BN('1')
  );
  await proxy.execute(MAKER_PROXY_ACTIONS, data, { from: owner });
}

// If will fail with 'npm run test "./test/Fee.test.js" "./test/HMaker_Swap.test.js"'
// but will success with 'npm run test "./test/HMaker_Swap.test.js"'
// looks like hardhat network bug, so skip this test caes
contract.skip('Maker', function([_, user]) {
  let id;
  const tokenAddress = DAI_TOKEN;
  let providerAddress;

  before(async function() {
    providerAddress = await tokenProviderUniV2(tokenAddress);

    this.registry = await Registry.new();
    this.feeRuleRegistry = await FeeRuleRegistry.new('0', _);
    this.proxy = await Proxy.new(
      this.registry.address,
      this.feeRuleRegistry.address
    );
    this.token = await IToken.at(tokenAddress);
    this.hMaker = await HMaker.new();
    await this.registry.register(
      this.hMaker.address,
      utils.asciiToHex('Maker')
    );
    this.hUniswap = await HUniswapV2.new();
    await this.registry.register(
      this.hUniswap.address,
      utils.asciiToHex('UniswapV2')
    );
    this.dsRegistry = await IDSProxyRegistry.at(MAKER_PROXY_REGISTRY);
    this.cdpManager = await IMakerManager.at(MAKER_CDP_MANAGER);
    this.vat = await IMakerVat.at(MAKER_MCD_VAT);
    await this.dsRegistry.build(this.proxy.address);

    const dsProxyAddr = await this.dsRegistry.proxies.call(user);
    if (dsProxyAddr == constants.ZERO_ADDRESS)
      await this.dsRegistry.build(user);

    this.dsProxy = await IDSProxy.at(
      await this.dsRegistry.proxies.call(this.proxy.address)
    );
    this.userProxy = await IDSProxy.at(
      await this.dsRegistry.proxies.call(user)
    );
    this.dai = await IToken.at(DAI_TOKEN);
  });

  beforeEach(async function() {
    id = await evmSnapshot();
  });

  afterEach(async function() {
    await evmRevert(id);
  });

  describe('Open new cdp', function() {
    describe('Lock Ether', function() {
      describe('Draw Dai and swap', function() {
        let balanceUser;

        before(async function() {
          this.token = await IToken.at(tokenAddress);
          this.router = await IUniswapV2Router.at(UNISWAPV2_ROUTER02);
        });

        beforeEach(async function() {
          balanceUser = await tracker(user);
          balanceProxy = await tracker(this.proxy.address);
          tokenUser = await this.token.balanceOf(user);
        });

        it('normal', async function() {
          const daiUser = await this.dai.balanceOf.call(user);
          const config = [ZERO_BYTES32, ZERO_BYTES32];
          const ruleIndex = [];
          const to1 = this.hMaker.address;
          const ilkEth = utils.padRight(utils.asciiToHex('ETH-A'), 64);

          const [
            generateLimit,
            minCollateral,
          ] = await getGenerateLimitAndMinCollateral(ilkEth);
          const value1 = minCollateral;
          const wadD = generateLimit;
          const data1 = abi.simpleEncode(
            'openLockETHAndDraw(uint256,address,address,bytes32,uint256)',
            value1,
            MAKER_MCD_JOIN_ETH_A,
            MAKER_MCD_JOIN_DAI,
            ilkEth,
            wadD
          );
          const value2 = generateLimit;
          const path = [tokenAddress, WETH_TOKEN];
          const to2 = this.hUniswap.address;
          const data2 = abi.simpleEncode(
            'swapExactTokensForETH(uint256,uint256,address[]):(uint256[])',
            value2,
            new BN('1'),
            path
          );
          const receipt = await this.proxy.batchExec(
            [to1, to2],
            config,
            [data1, data2],
            ruleIndex,
            {
              from: user,
              value: value1,
            }
          );
          const daiUserEnd = await this.dai.balanceOf.call(user);
          expect(daiUserEnd.sub(daiUser)).to.be.bignumber.eq(ether('0'));
          expect(await balanceUser.delta()).to.be.bignumber.lte(ether('0'));
        });
      });
    });
  });
});
