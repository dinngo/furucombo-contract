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
  ETH_TOKEN,
  ETH_PROVIDER,
  DAI_TOKEN,
  DAI_PROVIDER,
  AAVEPROTOCOL_PROVIDER,
  MAKER_CDP_MANAGER,
  MAKER_PROXY_FACTORY,
  MAKER_PROXY_ACTIONS,
  MAKER_PROXY_REGISTRY,
  MAKER_MCD_JUG,
  MAKER_MCD_VAT,
  MAKER_MCD_JOIN_ETH_A,
  MAKER_MCD_JOIN_DAI,
} = require('./utils/constants');
const { evmRevert, evmSnapshot, profileGas } = require('./utils/utils');

const HAave = artifacts.require('HAaveProtocol');
const HMaker = artifacts.require('HMaker');
const HUniswap = artifacts.require('HUniswap');
const Registry = artifacts.require('Registry');
const Proxy = artifacts.require('ProxyMock');
const IToken = artifacts.require('IERC20');
const ILendingPool = artifacts.require('ILendingPool');
const IProvider = artifacts.require('ILendingPoolAddressesProvider');
const IUniswapExchange = artifacts.require('IUniswapExchange');
const IDSProxy = artifacts.require('IDSProxy');
const IDSProxyRegistry = artifacts.require('IDSProxyRegistry');
const IMakerManager = artifacts.require('IMakerManager');
const IMakerVat = artifacts.require('IMakerVat');

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

contract('Aave flashloan', function([_, user]) {
  let id;
  let balanceUser;
  let balanceProxy;

  before(async function() {
    this.registry = await Registry.new();
    this.proxy = await Proxy.new(this.registry.address);
    this.haave = await HAave.new();
    this.hmaker = await HMaker.new();
    await this.registry.register(
      this.haave.address,
      utils.asciiToHex('Aave Protocol')
    );
    await this.registry.register(
      this.hmaker.address,
      utils.asciiToHex('Maker')
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
    this.provider = await IProvider.at(AAVEPROTOCOL_PROVIDER);
    const lendingPoolAddress = await this.provider.getLendingPool.call();
    this.lendingPool = await ILendingPool.at(lendingPoolAddress);
    await this.registry.register(lendingPoolAddress, this.haave.address);
  });

  beforeEach(async function() {
    id = await evmSnapshot();
    balanceUser = await tracker(user);
    balanceProxy = await tracker(this.proxy.address);
  });

  afterEach(async function() {
    await evmRevert(id);
  });

  describe('Maker', function() {
    let cdp;
    let ilk;
    let debt;
    let lock;
    let balanceUser;

    beforeEach(async function() {
      const etherAmount = ether('1');
      const new1 = abi.simpleEncode(
        'openLockETHAndDraw(address,address,address,address,bytes32,uint256)',
        MAKER_CDP_MANAGER,
        MAKER_MCD_JUG,
        MAKER_MCD_JOIN_ETH_A,
        MAKER_MCD_JOIN_DAI,
        utils.padRight(utils.asciiToHex('ETH-A'), 64),
        ether('0')
      );
      await this.userproxy.execute(MAKER_PROXY_ACTIONS, new1, {
        from: user,
        value: etherAmount,
      });
      cdp = await this.cdpmanager.last.call(this.userproxy.address);
      balanceUser = await tracker(user);
      [ilk, debt, lock] = await getCdpInfo(cdp);
    });

    it('withdraw', async function() {
      await approveCdp(cdp, user, this.dsproxy.address);
      balanceUser = await tracker(user);
      const wad = ether('1');
      const testTo = [this.hmaker.address];
      const testData = [
        '0x' +
          abi
            .simpleEncode(
              'freeETH(address,uint256,uint256)',
              MAKER_MCD_JOIN_ETH_A,
              cdp,
              wad
            )
            .toString('hex'),
      ];
      const test = web3.eth.abi.encodeParameters(
        ['address[]', 'bytes[]'],
        [testTo, testData]
      );
      const to = this.haave.address;
      const value = ether('0.1');
      const data = abi.simpleEncode(
        'flashLoan(address,uint256,bytes)',
        ETH_TOKEN,
        value,
        util.toBuffer(test)
      );
      const receipt = await this.proxy.execMock(to, data, {
        from: user,
        value: ether('0.2'),
      });
      const [ilkEnd, debtEnd, lockEnd] = await getCdpInfo(cdp);
      expect(await balanceUser.delta()).to.be.bignumber.eq(
        wad
          .sub(value.mul(new BN('9')).div(new BN('10000')))
          .sub(new BN(receipt.receipt.gasUsed))
      );
      expect(lockEnd.sub(lock)).to.be.bignumber.eq(ether('0').sub(wad));
    });
  });
});
