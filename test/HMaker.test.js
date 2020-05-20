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
  MAKER_CDP_MANAGER,
  MAKER_PROXY_FACTORY,
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
const Registry = artifacts.require('Registry');
const Proxy = artifacts.require('ProxyMock');
const IToken = artifacts.require('IERC20');
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

contract('Maker', function([_, deployer, user1, user2]) {
  before(async function() {
    this.registry = await Registry.new();
    this.proxy = await Proxy.new(this.registry.address);
    this.hmaker = await HMaker.new();
    await this.registry.register(
      this.hmaker.address,
      utils.asciiToHex('Maker')
    );
    this.dsregistry = await IDSProxyRegistry.at(MAKER_PROXY_REGISTRY);
    this.cdpmanager = await IMakerManager.at(MAKER_CDP_MANAGER);
    this.vat = await IMakerVat.at(MAKER_MCD_VAT);
    await this.dsregistry.build(this.proxy.address);
    this.dsproxy = await IDSProxy.at(
      await this.dsregistry.proxies.call(this.proxy.address)
    );
    this.dai = await IToken.at(DAI_TOKEN);
  });

  beforeEach(async function() {
    await resetAccount(_);
    await resetAccount(user1);
    await resetAccount(user2);
  });

  describe('Open new cdp', function() {
    let balanceUser1;
    let balanceUser2;
    let daiUser1;
    let daiUser2;

    beforeEach(async function() {
      balanceUser1 = await tracker(user1);
      balanceUser2 = await tracker(user2);
      daiUser1 = await this.dai.balanceOf.call(user1);
      daiUser2 = await this.dai.balanceOf.call(user2);
    });

    describe('Lock Ether', function() {
      describe('Draw Dai', function() {
        it('User does not has proxy', async function() {
          expect(await this.dsregistry.proxies.call(this.proxy.address)).not.eq(
            ZERO_ADDRESS
          );
          expect(await this.dsregistry.proxies.call(user1)).eq(ZERO_ADDRESS);

          const to = this.hmaker.address;
          const value = ether('1');
          const ilkEth = utils.padRight(utils.asciiToHex('ETH-A'), 64);
          const wadD = ether('20');
          const data = abi.simpleEncode(
            'openLockETHAndDraw(uint256,address,address,bytes32,uint256)',
            value,
            MAKER_MCD_JOIN_ETH_A,
            MAKER_MCD_JOIN_DAI,
            ilkEth,
            wadD
          );
          const receipt = await this.proxy.execMock(to, data, {
            from: user1,
            value: ether('10'),
          });
          expect(
            await this.cdpmanager.count.call(this.dsproxy.address)
          ).to.be.bignumber.eq(new BN('0'));
          const userProxy = await this.dsregistry.proxies.call(user1);
          const cdp = await this.cdpmanager.last.call(userProxy);

          const [ilk, debt, lock] = await getCdpInfo(cdp);

          expect(ilk).eq(ilkEth);
          expect(debt).to.be.bignumber.not.lt(wadD.mul(RAY));
          expect(lock).to.be.bignumber.eq(value);
          expect(
            (await this.dai.balanceOf.call(user1)).sub(daiUser1)
          ).to.be.bignumber.eq(wadD);
        });

        it('User has proxy', async function() {
          expect(await this.dsregistry.proxies.call(this.proxy.address)).not.eq(
            ZERO_ADDRESS
          );
          expect(await this.dsregistry.proxies.call(user1)).not.eq(
            ZERO_ADDRESS
          );

          const to = this.hmaker.address;
          const value = ether('1');
          const ilkEth = utils.padRight(utils.asciiToHex('ETH-A'), 64);
          const wadD = ether('20');
          const data = abi.simpleEncode(
            'openLockETHAndDraw(uint256,address,address,bytes32,uint256)',
            value,
            MAKER_MCD_JOIN_ETH_A,
            MAKER_MCD_JOIN_DAI,
            ilkEth,
            wadD
          );
          const receipt = await this.proxy.execMock(to, data, {
            from: user1,
            value: ether('10'),
          });
          expect(
            await this.cdpmanager.count.call(this.dsproxy.address)
          ).to.be.bignumber.eq(new BN('0'));
          const userProxy = await this.dsregistry.proxies.call(user1);
          const cdp = await this.cdpmanager.last.call(userProxy);

          const [ilk, debt, lock] = await getCdpInfo(cdp);

          expect(ilk).eq(ilkEth);
          expect(debt).to.be.bignumber.not.lt(wadD.mul(RAY));
          expect(lock).to.be.bignumber.eq(value);
          expect(
            (await this.dai.balanceOf.call(user1)).sub(daiUser1)
          ).to.be.bignumber.eq(wadD);
        });
      });
    });

    describe('Lock Token', function() {
      const tokenAddress = BAT_TOKEN;
      const providerAddress = BAT_PROVIDER;

      let tokenUser2;

      before(async function() {
        this.token = await IToken.at(tokenAddress);
      });

      beforeEach(async function() {
        tokenUser2 = await this.token.balanceOf.call(user2);
      });

      describe('Draw Dai', function() {
        it('User does not has proxy', async function() {
          expect(await this.dsregistry.proxies.call(this.proxy.address)).not.eq(
            ZERO_ADDRESS
          );
          expect(await this.dsregistry.proxies.call(user2)).eq(ZERO_ADDRESS);

          const to = this.hmaker.address;
          const ilkBat = utils.padRight(utils.asciiToHex('BAT-A'), 64);
          const wadC = ether('200');
          const wadD = ether('20');
          const data = abi.simpleEncode(
            'openLockGemAndDraw(address,address,bytes32,uint256,uint256)',
            MAKER_MCD_JOIN_BAT_A,
            MAKER_MCD_JOIN_DAI,
            ilkBat,
            wadC,
            wadD
          );
          await this.token.transfer(this.proxy.address, wadC, {
            from: providerAddress,
          });
          await this.proxy.updateTokenMock(this.token.address);
          const receipt = await this.proxy.execMock(to, data, {
            from: user2,
            value: ether('1'),
          });
          expect(
            await this.cdpmanager.count.call(this.dsproxy.address)
          ).to.be.bignumber.eq(new BN('0'));
          const userProxy = await this.dsregistry.proxies.call(user2);
          const cdp = await this.cdpmanager.last.call(userProxy);

          const [ilk, debt, lock] = await getCdpInfo(cdp);

          expect(ilk).eq(ilkBat);
          expect(debt).to.be.bignumber.not.lt(wadD.mul(RAY));
          expect(lock).to.be.bignumber.eq(wadC);
          expect(
            (await this.dai.balanceOf.call(user2)).sub(daiUser2)
          ).to.be.bignumber.eq(wadD);
        });

        it('User has proxy', async function() {
          expect(await this.dsregistry.proxies.call(this.proxy.address)).not.eq(
            ZERO_ADDRESS
          );
          expect(await this.dsregistry.proxies.call(user2)).not.eq(
            ZERO_ADDRESS
          );

          const to = this.hmaker.address;
          const ilkBat = utils.padRight(utils.asciiToHex('BAT-A'), 64);
          const wadC = ether('200');
          const wadD = ether('20');
          const data = abi.simpleEncode(
            'openLockGemAndDraw(address,address,bytes32,uint256,uint256)',
            MAKER_MCD_JOIN_BAT_A,
            MAKER_MCD_JOIN_DAI,
            ilkBat,
            wadC,
            wadD
          );
          await this.token.transfer(this.proxy.address, wadC, {
            from: providerAddress,
          });
          await this.proxy.updateTokenMock(this.token.address);
          const receipt = await this.proxy.execMock(to, data, {
            from: user2,
            value: ether('1'),
          });
          expect(
            await this.cdpmanager.count.call(this.dsproxy.address)
          ).to.be.bignumber.eq(new BN('0'));
          const userProxy = await this.dsregistry.proxies.call(user2);
          const cdp = await this.cdpmanager.last.call(userProxy);

          const [ilk, debt, lock] = await getCdpInfo(cdp);

          expect(ilk).eq(ilkBat);
          expect(debt).to.be.bignumber.not.lt(wadD.mul(RAY));
          expect(lock).to.be.bignumber.eq(wadC);
          expect(
            (await this.dai.balanceOf.call(user2)).sub(daiUser2)
          ).to.be.bignumber.eq(wadD);
        });
      });
    });
  });
});
