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
const { ZERO_ADDRESS } = constants;

const { expect } = require('chai');

const {
  BAT_TOKEN,
  BAT_PROVIDER,
  DAI_TOKEN,
  DAI_PROVIDER,
  DAI_UNISWAP,
  MAKER_CDP_MANAGER,
  MAKER_PROXY_FACTORY,
  MAKER_PROXY_ACTIONS,
  MAKER_PROXY_REGISTRY,
  MAKER_MCD_JUG,
  MAKER_MCD_VAT,
  MAKER_MCD_JOIN_ETH_A,
  MAKER_MCD_JOIN_BAT_A,
  MAKER_MCD_JOIN_USDC_A,
  MAKER_MCD_JOIN_WBTC_A,
  MAKER_MCD_JOIN_DAI,
} = require('./utils/constants');
const { resetAccount, profileGas } = require('./utils/utils');

const HMaker = artifacts.require('HMaker');
const HUniswap = artifacts.require('HUniswap');
const Registry = artifacts.require('Registry');
const Proxy = artifacts.require('ProxyMock');
const IToken = artifacts.require('IERC20');
const IDSProxy = artifacts.require('IDSProxy');
const IDSProxyRegistry = artifacts.require('IDSProxyRegistry');
const IMakerManager = artifacts.require('IMakerManager');
const IMakerVat = artifacts.require('IMakerVat');
const IUniswapExchange = artifacts.require('IUniswapExchange');

const RAY = new BN('1000000000000000000000000000');
const RAD = new BN('1000000000000000000000000000000000000000000000');

async function getCdpInfo(cdp) {
  const cdpManager = await IMakerManager.at(MAKER_CDP_MANAGER);
  const vat = await IMakerVat.at(MAKER_MCD_VAT);
  const urn = await cdpManager.urns.call(cdp);
  const ilk = await cdpManager.ilks.call(cdp);
  const conf = await vat.ilks.call(ilk);
  const urnStats = await vat.urns.call(ilk, urn);
  const ink = urnStats[0];
  const art = urnStats[1];
  const debt = art.mul(conf[1]);

  return [ilk, debt, ink];
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

contract('Maker', function([_, deployer, user]) {
  const tokenAddress = DAI_TOKEN;
  const uniswapAddress = DAI_UNISWAP;
  const providerAddress = DAI_PROVIDER;
  before(async function() {
    this.registry = await Registry.new();
    this.proxy = await Proxy.new(this.registry.address);
    this.token = await IToken.at(tokenAddress);
    this.hmaker = await HMaker.new();
    await this.registry.register(
      this.hmaker.address,
      utils.asciiToHex('Maker')
    );
    this.huniswap = await HUniswap.new();
    await this.registry.register(
      this.huniswap.address,
      utils.asciiToHex('Uniswap')
    );
    this.dsregistry = await IDSProxyRegistry.at(MAKER_PROXY_REGISTRY);
    this.cdpmanager = await IMakerManager.at(MAKER_CDP_MANAGER);
    this.vat = await IMakerVat.at(MAKER_MCD_VAT);
    await this.dsregistry.build(this.proxy.address);
    await this.dsregistry.build(user);
    this.dsproxy = await IDSProxy.at(
      await this.dsregistry.proxies.call(this.proxy.address)
    );
    this.userproxy = await IDSProxy.at(
      await this.dsregistry.proxies.call(user)
    );
    this.dai = await IToken.at(DAI_TOKEN);
  });

  beforeEach(async function() {
    await resetAccount(_);
    await resetAccount(user);
  });

  describe('Open new cdp', function() {
    let daiUser;

    beforeEach(async function() {
      daiUser = await this.dai.balanceOf.call(user);
    });

    describe('Lock Ether', function() {
      describe('Draw Dai', function() {
        let balanceUser;
        let balanceProxy;
        let tokenUser;

        before(async function() {
          this.token = await IToken.at(tokenAddress);
          this.swap = await IUniswapExchange.at(uniswapAddress);
        });

        beforeEach(async function() {
          balanceUser = await tracker(user);
          balanceProxy = await tracker(this.proxy.address);
          tokenUser = await this.token.balanceOf(user);
        });

        it('normal', async function() {
          const daiUser = await this.dai.balanceOf.call(user);
          const to1 = this.hmaker.address;
          const value1 = ether('1');
          const ilkEth = utils.padRight(utils.asciiToHex('ETH-A'), 64);
          const wadD = ether('100');
          const data1 = abi.simpleEncode(
            'openLockETHAndDraw(uint256,address,address,bytes32,uint256)',
            value1,
            MAKER_MCD_JOIN_ETH_A,
            MAKER_MCD_JOIN_DAI,
            ilkEth,
            wadD
          );
          const value2 = ether('100');
          const to2 = this.huniswap.address;
          const data2 = abi.simpleEncode(
            'tokenToEthSwapInput(address,uint256,uint256):(uint256)',
            tokenAddress,
            value2,
            new BN('1')
          );
          const receipt = await this.proxy.batchExec(
            [to1, to2],
            [data1, data2],
            {
              from: user,
              value: ether('1'),
            }
          );
          const daiUserEnd = await this.dai.balanceOf.call(user);
          expect(daiUserEnd.sub(daiUser)).to.be.bignumber.eq(ether('0'));
          expect(await balanceUser.delta()).to.be.bignumber.lte(
            ether('0').sub(new BN(receipt.receipt.gasUsed))
          );
        });
      });
    });
  });
});
