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
  KNC_TOKEN,
  KNC_PROVIDER,
  DAI_TOKEN,
  DAI_PROVIDER,
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
  MAKER_MCD_JOIN_KNC_A,
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

contract('Maker', function([_, deployer, user1, user2, user3, user4]) {
  const tokenAddress = KNC_TOKEN;
  const providerAddress = KNC_PROVIDER;

  before(async function() {
    this.registry = await Registry.new();
    this.proxy = await Proxy.new(this.registry.address);
    this.token = await IToken.at(tokenAddress);
    this.hmaker = await HMaker.new();
    await this.registry.register(
      this.hmaker.address,
      utils.asciiToHex('Maker')
    );
    this.dsregistry = await IDSProxyRegistry.at(MAKER_PROXY_REGISTRY);
    this.cdpmanager = await IMakerManager.at(MAKER_CDP_MANAGER);
    this.vat = await IMakerVat.at(MAKER_MCD_VAT);
    await this.dsregistry.build(this.proxy.address);
    await this.dsregistry.build(user1);
    await this.dsregistry.build(user2);
    this.dsproxy = await IDSProxy.at(
      await this.dsregistry.proxies.call(this.proxy.address)
    );
    this.user1proxy = await IDSProxy.at(
      await this.dsregistry.proxies.call(user1)
    );
    this.user2proxy = await IDSProxy.at(
      await this.dsregistry.proxies.call(user2)
    );
    this.dai = await IToken.at(DAI_TOKEN);
  });

  beforeEach(async function() {
    await resetAccount(_);
    await resetAccount(user1);
    await resetAccount(user2);
  });

  describe('Open new cdp', function() {
    let daiUser1;
    let daiUser2;

    beforeEach(async function() {
      daiUser1 = await this.dai.balanceOf.call(user1);
      daiUser2 = await this.dai.balanceOf.call(user2);
    });

    describe('Lock Ether', function() {
      describe('Draw Dai', function() {
        it('User does not has proxy', async function() {
          const daiUser = await this.dai.balanceOf.call(user3);

          expect(await this.dsregistry.proxies.call(this.proxy.address)).not.eq(
            ZERO_ADDRESS
          );
          expect(await this.dsregistry.proxies.call(user3)).eq(ZERO_ADDRESS);

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
            from: user3,
            value: ether('10'),
          });
          expect(
            await this.cdpmanager.count.call(this.dsproxy.address)
          ).to.be.bignumber.eq(new BN('0'));
          const userProxy = await this.dsregistry.proxies.call(user3);
          const cdp = await this.cdpmanager.last.call(userProxy);

          const [ilk, debt, lock] = await getCdpInfo(cdp);

          expect(ilk).eq(ilkEth);
          expect(debt).to.be.bignumber.gte(wadD.mul(RAY));
          expect(lock).to.be.bignumber.eq(value);
          expect(
            (await this.dai.balanceOf.call(user3)).sub(daiUser)
          ).to.be.bignumber.eq(wadD);
          profileGas(receipt);
        });

        it('User has proxy', async function() {
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
          expect(debt).to.be.bignumber.gte(wadD.mul(RAY));
          expect(lock).to.be.bignumber.eq(value);
          expect(
            (await this.dai.balanceOf.call(user1)).sub(daiUser1)
          ).to.be.bignumber.eq(wadD);
          profileGas(receipt);
        });
      });
    });

    describe('Lock Token', function() {
      const tokenAddress = KNC_TOKEN;
      const providerAddress = KNC_PROVIDER;

      before(async function() {});

      describe('Draw Dai', function() {
        it('User does not has proxy', async function() {
          const daiUser = await this.dai.balanceOf.call(user4);

          expect(await this.dsregistry.proxies.call(this.proxy.address)).not.eq(
            ZERO_ADDRESS
          );
          expect(await this.dsregistry.proxies.call(user4)).eq(ZERO_ADDRESS);

          const to = this.hmaker.address;
          const ilkKnc = utils.padRight(utils.asciiToHex('KNC-A'), 64);
          const wadC = ether('200');
          const wadD = ether('20');
          const data = abi.simpleEncode(
            'openLockGemAndDraw(address,address,bytes32,uint256,uint256)',
            MAKER_MCD_JOIN_KNC_A,
            MAKER_MCD_JOIN_DAI,
            ilkKnc,
            wadC,
            wadD
          );
          await this.token.transfer(this.proxy.address, wadC, {
            from: providerAddress,
          });
          await this.proxy.updateTokenMock(this.token.address);
          const receipt = await this.proxy.execMock(to, data, {
            from: user4,
            value: ether('1'),
          });
          expect(
            await this.cdpmanager.count.call(this.dsproxy.address)
          ).to.be.bignumber.eq(new BN('0'));
          const userProxy = await this.dsregistry.proxies.call(user4);
          const cdp = await this.cdpmanager.last.call(userProxy);

          const [ilk, debt, lock] = await getCdpInfo(cdp);

          expect(ilk).eq(ilkKnc);
          expect(debt).to.be.bignumber.gte(wadD.mul(RAY));
          expect(lock).to.be.bignumber.eq(wadC);
          expect(
            (await this.dai.balanceOf.call(user4)).sub(daiUser)
          ).to.be.bignumber.eq(wadD);
          profileGas(receipt);
        });

        it('User has proxy', async function() {
          const to = this.hmaker.address;
          const ilkKnc = utils.padRight(utils.asciiToHex('KNC-A'), 64);
          const wadC = ether('200');
          const wadD = ether('20');
          const data = abi.simpleEncode(
            'openLockGemAndDraw(address,address,bytes32,uint256,uint256)',
            MAKER_MCD_JOIN_KNC_A,
            MAKER_MCD_JOIN_DAI,
            ilkKnc,
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

          expect(ilk).eq(ilkKnc);
          expect(debt).to.be.bignumber.gte(wadD.mul(RAY));
          expect(lock).to.be.bignumber.eq(wadC);
          expect(
            (await this.dai.balanceOf.call(user2)).sub(daiUser2)
          ).to.be.bignumber.eq(wadD);
          profileGas(receipt);
        });
      });
    });
  });

  describe('Deposit', function() {
    let cdp;
    let ilk;
    let debt;
    let lock;

    before(async function() {
      const new1 = abi.simpleEncode(
        'open(address,bytes32,address)',
        MAKER_CDP_MANAGER,
        utils.padRight(utils.asciiToHex('ETH-A'), 64),
        this.user1proxy.address
      );
      const new2 = abi.simpleEncode(
        'open(address,bytes32,address)',
        MAKER_CDP_MANAGER,
        utils.padRight(utils.asciiToHex('KNC-A'), 64),
        this.user2proxy.address
      );
      await this.user1proxy.execute(MAKER_PROXY_ACTIONS, new1, { from: user1 });
      await this.user2proxy.execute(MAKER_PROXY_ACTIONS, new2, { from: user2 });
    });

    describe('Lock Ether', function() {
      let balanceUser;
      before(async function() {
        cdp = await this.cdpmanager.last.call(this.user1proxy.address);
        expect(cdp).to.be.bignumber.not.eq(new BN('0'));
      });

      beforeEach(async function() {
        balanceUser = await tracker(user1);
        [ilk, debt, lock] = await getCdpInfo(cdp);
      });

      it('normal', async function() {
        const to = this.hmaker.address;
        const value = ether('1');
        const data = abi.simpleEncode(
          'safeLockETH(uint256,address,uint256)',
          value,
          MAKER_MCD_JOIN_ETH_A,
          cdp
        );
        const receipt = await this.proxy.execMock(to, data, {
          from: user1,
          value: value,
        });

        const [ilkEnd, debtEnd, lockEnd] = await getCdpInfo(cdp);
        expect(await balanceUser.delta()).to.be.bignumber.eq(
          ether('0')
            .sub(value)
            .sub(new BN(receipt.receipt.gasUsed))
        );
        expect(lockEnd.sub(lock)).to.be.bignumber.eq(value);
        profileGas(receipt);
      });
    });

    describe('Lock Token', function() {
      let balanceUser;
      let tokenUser;
      const tokenAddress = KNC_TOKEN;
      const providerAddress = KNC_PROVIDER;

      before(async function() {
        cdp = await this.cdpmanager.last.call(this.user2proxy.address);
        expect(cdp).to.be.bignumber.not.eq(new BN('0'));
      });

      beforeEach(async function() {
        balanceUser = await tracker(user1);
        [ilk, debt, lock] = await getCdpInfo(cdp);
        tokenUser = await this.token.balanceOf.call(user2);
      });

      it('normal', async function() {
        const to = this.hmaker.address;
        const wad = ether('100');
        const data = abi.simpleEncode(
          'safeLockGem(address,uint256,uint256)',
          MAKER_MCD_JOIN_KNC_A,
          cdp,
          wad
        );
        await this.token.transfer(this.proxy.address, wad, {
          from: providerAddress,
        });
        await this.proxy.updateTokenMock(this.token.address);
        const receipt = await this.proxy.execMock(to, data, {
          from: user2,
          value: ether('1'),
        });

        const [ilkEnd, debtEnd, lockEnd] = await getCdpInfo(cdp);
        expect(lockEnd.sub(lock)).to.be.bignumber.eq(wad);
        profileGas(receipt);
      });
    });
  });

  describe('Withdraw', function() {
    describe('free ETH', function() {
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
        await this.user1proxy.execute(MAKER_PROXY_ACTIONS, new1, {
          from: user1,
          value: etherAmount,
        });
        cdp = await this.cdpmanager.last.call(this.user1proxy.address);
        balanceUser = await tracker(user1);
        [ilk, debt, lock] = await getCdpInfo(cdp);
      });

      it('normal', async function() {
        await approveCdp(cdp, user1, this.dsproxy.address);
        balanceUser = await tracker(user1);
        const to = this.hmaker.address;
        const wad = ether('1');
        const data = abi.simpleEncode(
          'freeETH(address,uint256,uint256)',
          MAKER_MCD_JOIN_ETH_A,
          cdp,
          wad
        );
        const receipt = await this.proxy.execMock(to, data, {
          from: user1,
        });
        const [ilkEnd, debtEnd, lockEnd] = await getCdpInfo(cdp);
        expect(await balanceUser.delta()).to.be.bignumber.eq(
          wad.sub(new BN(receipt.receipt.gasUsed))
        );
        expect(lockEnd.sub(lock)).to.be.bignumber.eq(ether('0').sub(wad));
        profileGas(receipt);
      });

      it('without cdp approval', async function() {
        balanceUser = await tracker(user1);
        const to = this.hmaker.address;
        const wad = ether('1');
        const data = abi.simpleEncode(
          'freeETH(address,uint256,uint256)',
          MAKER_MCD_JOIN_ETH_A,
          cdp,
          wad
        );
        await expectRevert.unspecified(
          this.proxy.execMock(to, data, {
            from: user1,
          })
        );
      });

      it('approved but triggered by unauthorized user', async function() {
        await approveCdp(cdp, user1, this.dsproxy.address);
        balanceUser = await tracker(user1);
        const to = this.hmaker.address;
        const wad = ether('1');
        const data = abi.simpleEncode(
          'freeETH(address,uint256,uint256)',
          MAKER_MCD_JOIN_ETH_A,
          cdp,
          wad
        );
        await expectRevert(
          this.proxy.execMock(to, data),
          'Unauthorized sender of cdp'
        );
      });
    });

    describe('free token', function() {
      let cdp;
      let ilk;
      let debt;
      let lock;
      let tokenUser;

      beforeEach(async function() {
        const tokenAmount = ether('100');
        const new2 = abi.simpleEncode(
          'openLockGemAndDraw(address,address,address,address,bytes32,uint256,uint256,bool)',
          MAKER_CDP_MANAGER,
          MAKER_MCD_JUG,
          MAKER_MCD_JOIN_KNC_A,
          MAKER_MCD_JOIN_DAI,
          utils.padRight(utils.asciiToHex('KNC-A'), 64),
          tokenAmount,
          ether('0'),
          true
        );
        await this.token.transfer(user2, tokenAmount, {
          from: providerAddress,
        });
        await this.token.approve(this.user2proxy.address, tokenAmount, {
          from: user2,
        });
        await this.user2proxy.execute(MAKER_PROXY_ACTIONS, new2, {
          from: user2,
        });
        cdp = await this.cdpmanager.last.call(this.user2proxy.address);
        tokenUser = await this.token.balanceOf.call(user2);
        [ilk, debt, lock] = await getCdpInfo(cdp);
      });

      it('normal', async function() {
        await approveCdp(cdp, user2, this.dsproxy.address);
        const to = this.hmaker.address;
        const wad = ether('100');
        const data = abi.simpleEncode(
          'freeGem(address,uint256,uint256)',
          MAKER_MCD_JOIN_KNC_A,
          cdp,
          wad
        );
        const receipt = await this.proxy.execMock(to, data, {
          from: user2,
        });
        const [ilkEnd, debtEnd, lockEnd] = await getCdpInfo(cdp);
        const tokenUserEnd = await this.token.balanceOf.call(user2);
        expect(tokenUserEnd.sub(tokenUser)).to.be.bignumber.eq(wad);
        expect(lockEnd.sub(lock)).to.be.bignumber.eq(ether('0').sub(wad));
        profileGas(receipt);
      });

      it('without cdp approval', async function() {
        const to = this.hmaker.address;
        const wad = ether('100');
        const data = abi.simpleEncode(
          'freeGem(address,uint256,uint256)',
          MAKER_MCD_JOIN_KNC_A,
          cdp,
          wad
        );
        await expectRevert.unspecified(
          this.proxy.execMock(to, data, {
            from: user2,
          })
        );
      });

      it('approved but triggered by unauthorized user', async function() {
        await approveCdp(cdp, user2, this.dsproxy.address);
        const to = this.hmaker.address;
        const wad = ether('100');
        const data = abi.simpleEncode(
          'freeGem(address,uint256,uint256)',
          MAKER_MCD_JOIN_KNC_A,
          cdp,
          wad
        );
        await expectRevert(
          this.proxy.execMock(to, data),
          'Unauthorized sender of cdp'
        );
      });
    });
  });

  describe('Generate', function() {
    describe('draw from ETH cdp', function() {
      let cdp;
      let ilk;
      let debt;
      let lock;
      let daiUser;

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
        await this.user1proxy.execute(MAKER_PROXY_ACTIONS, new1, {
          from: user1,
          value: etherAmount,
        });
        cdp = await this.cdpmanager.last.call(this.user1proxy.address);
        daiUser = await this.dai.balanceOf.call(user1);
        [ilk, debt, lock] = await getCdpInfo(cdp);
      });

      it('normal', async function() {
        await approveCdp(cdp, user1, this.dsproxy.address);
        const to = this.hmaker.address;
        const wad = ether('20');
        const data = abi.simpleEncode(
          'draw(address,uint256,uint256)',
          MAKER_MCD_JOIN_DAI,
          cdp,
          wad
        );
        const receipt = await this.proxy.execMock(to, data, {
          from: user1,
        });
        const [ilkEnd, debtEnd, lockEnd] = await getCdpInfo(cdp);
        const daiUserEnd = await this.dai.balanceOf.call(user1);
        expect(daiUserEnd.sub(daiUser)).to.be.bignumber.eq(wad);
        expect(debtEnd.div(RAY)).to.be.bignumber.gte(wad);
        profileGas(receipt);
      });

      it('without cdp approval', async function() {
        const to = this.hmaker.address;
        const wad = ether('20');
        const data = abi.simpleEncode(
          'draw(address,uint256,uint256)',
          MAKER_MCD_JOIN_DAI,
          cdp,
          wad
        );
        await expectRevert.unspecified(
          this.proxy.execMock(to, data, {
            from: user1,
          })
        );
      });

      it('approved but triggered by unauthorized user', async function() {
        await approveCdp(cdp, user1, this.dsproxy.address);
        const to = this.hmaker.address;
        const wad = ether('20');
        const data = abi.simpleEncode(
          'draw(address,uint256,uint256)',
          MAKER_MCD_JOIN_DAI,
          cdp,
          wad
        );
        await expectRevert(
          this.proxy.execMock(to, data),
          'Unauthorized sender of cdp'
        );
      });
    });

    describe('draw from gem cdp', function() {
      let cdp;
      let ilk;
      let debt;
      let lock;
      let daiUser;

      beforeEach(async function() {
        const tokenAmount = ether('1000');
        const new2 = abi.simpleEncode(
          'openLockGemAndDraw(address,address,address,address,bytes32,uint256,uint256,bool)',
          MAKER_CDP_MANAGER,
          MAKER_MCD_JUG,
          MAKER_MCD_JOIN_KNC_A,
          MAKER_MCD_JOIN_DAI,
          utils.padRight(utils.asciiToHex('KNC-A'), 64),
          tokenAmount,
          ether('0'),
          true
        );
        await this.token.transfer(user2, tokenAmount, {
          from: providerAddress,
        });
        await this.token.approve(this.user2proxy.address, tokenAmount, {
          from: user2,
        });
        await this.user2proxy.execute(MAKER_PROXY_ACTIONS, new2, {
          from: user2,
        });
        cdp = await this.cdpmanager.last.call(this.user2proxy.address);
        daiUser = await this.dai.balanceOf.call(user2);
        [ilk, debt, lock] = await getCdpInfo(cdp);
      });

      it('normal', async function() {
        await approveCdp(cdp, user2, this.dsproxy.address);
        const to = this.hmaker.address;
        const wad = ether('20');
        const data = abi.simpleEncode(
          'draw(address,uint256,uint256)',
          MAKER_MCD_JOIN_DAI,
          cdp,
          wad
        );
        const receipt = await this.proxy.execMock(to, data, {
          from: user2,
        });
        const [ilkEnd, debtEnd, lockEnd] = await getCdpInfo(cdp);
        const daiUserEnd = await this.dai.balanceOf.call(user2);
        expect(daiUserEnd.sub(daiUser)).to.be.bignumber.eq(wad);
        expect(debtEnd.div(RAY)).to.be.bignumber.gte(wad);
        profileGas(receipt);
      });

      it('without cdp approval', async function() {
        const to = this.hmaker.address;
        const wad = ether('20');
        const data = abi.simpleEncode(
          'draw(address,uint256,uint256)',
          MAKER_MCD_JOIN_DAI,
          cdp,
          wad
        );
        await expectRevert.unspecified(
          this.proxy.execMock(to, data, {
            from: user2,
          })
        );
      });

      it('approved but triggered by unauthorized user', async function() {
        await approveCdp(cdp, user2, this.dsproxy.address);
        const to = this.hmaker.address;
        const wad = ether('20');
        const data = abi.simpleEncode(
          'draw(address,uint256,uint256)',
          MAKER_MCD_JOIN_DAI,
          cdp,
          wad
        );
        await expectRevert(
          this.proxy.execMock(to, data),
          'Unauthorized sender of cdp'
        );
      });
    });
  });

  describe('Pay back', function() {
    describe('pay back to ETH cdp', function() {
      let cdp;
      let ilk;
      let debt;
      let lock;
      let daiUser;

      beforeEach(async function() {
        const etherAmount = ether('1');
        const daiAmount = ether('30');
        const new1 = abi.simpleEncode(
          'openLockETHAndDraw(address,address,address,address,bytes32,uint256)',
          MAKER_CDP_MANAGER,
          MAKER_MCD_JUG,
          MAKER_MCD_JOIN_ETH_A,
          MAKER_MCD_JOIN_DAI,
          utils.padRight(utils.asciiToHex('ETH-A'), 64),
          daiAmount
        );
        await this.user1proxy.execute(MAKER_PROXY_ACTIONS, new1, {
          from: user1,
          value: etherAmount,
        });
        cdp = await this.cdpmanager.last.call(this.user1proxy.address);
        daiUser = await this.dai.balanceOf.call(user1);
        [ilk, debt, lock] = await getCdpInfo(cdp);
      });

      it('wipe', async function() {
        const to = this.hmaker.address;
        const wad = ether('5');
        const data = abi.simpleEncode(
          'wipe(address,uint256,uint256)',
          MAKER_MCD_JOIN_DAI,
          cdp,
          wad
        );
        await this.dai.transfer(this.proxy.address, wad, {
          from: user1,
        });
        await this.proxy.updateTokenMock(this.dai.address);
        [ilk, debt, lock] = await getCdpInfo(cdp);
        const receipt = await this.proxy.execMock(to, data, {
          from: user1,
        });
        const [ilkEnd, debtEnd, lockEnd] = await getCdpInfo(cdp);
        const daiUserEnd = await this.dai.balanceOf.call(user1);
        expect(daiUserEnd.sub(daiUser)).to.be.bignumber.eq(ether('0').sub(wad));
        expect(debtEnd.sub(debt).div(RAY)).to.be.bignumber.gte(
          ether('0').sub(wad)
        );
        profileGas(receipt);
      });

      it('wipeAll', async function() {
        const to = this.hmaker.address;
        const data = abi.simpleEncode(
          'wipeAll(address,uint256)',
          MAKER_MCD_JOIN_DAI,
          cdp
        );
        await this.dai.transfer(user1, ether('10'), {
          from: DAI_PROVIDER,
        });
        daiUser = await this.dai.balanceOf.call(user1);
        await this.dai.transfer(this.proxy.address, ether('40'), {
          from: user1,
        });
        await this.proxy.updateTokenMock(this.dai.address);
        [ilk, debt, lock] = await getCdpInfo(cdp);
        const receipt = await this.proxy.execMock(to, data, {
          from: user1,
        });
        const [ilkEnd, debtEnd, lockEnd] = await getCdpInfo(cdp);
        const daiUserEnd = await this.dai.balanceOf.call(user1);
        expect(debtEnd).to.be.bignumber.eq(ether('0'));
        expect(daiUser.sub(daiUserEnd).sub(new BN('1'))).to.be.bignumber.gte(
          debt.div(RAY).sub(new BN('1'))
        );
        profileGas(receipt);
      });
    });

    describe('pay back to gem cdp', function() {
      let cdp;
      let ilk;
      let debt;
      let lock;
      let daiUser;

      beforeEach(async function() {
        const tokenAmount = ether('1000');
        const daiAmount = ether('30');
        const new2 = abi.simpleEncode(
          'openLockGemAndDraw(address,address,address,address,bytes32,uint256,uint256,bool)',
          MAKER_CDP_MANAGER,
          MAKER_MCD_JUG,
          MAKER_MCD_JOIN_KNC_A,
          MAKER_MCD_JOIN_DAI,
          utils.padRight(utils.asciiToHex('KNC-A'), 64),
          tokenAmount,
          daiAmount,
          true
        );
        await this.token.transfer(user2, tokenAmount, {
          from: providerAddress,
        });
        await this.token.approve(this.user2proxy.address, tokenAmount, {
          from: user2,
        });
        await this.user2proxy.execute(MAKER_PROXY_ACTIONS, new2, {
          from: user2,
        });
        cdp = await this.cdpmanager.last.call(this.user2proxy.address);
        daiUser = await this.dai.balanceOf.call(user2);
        [ilk, debt, lock] = await getCdpInfo(cdp);
      });

      it('wipe', async function() {
        const to = this.hmaker.address;
        const wad = ether('5');
        const data = abi.simpleEncode(
          'wipe(address,uint256,uint256)',
          MAKER_MCD_JOIN_DAI,
          cdp,
          wad
        );
        await this.dai.transfer(this.proxy.address, wad, {
          from: user2,
        });
        await this.proxy.updateTokenMock(this.dai.address);
        [ilk, debt, lock] = await getCdpInfo(cdp);
        const receipt = await this.proxy.execMock(to, data, {
          from: user2,
        });
        const [ilkEnd, debtEnd, lockEnd] = await getCdpInfo(cdp);
        const daiUserEnd = await this.dai.balanceOf.call(user2);
        expect(daiUserEnd.sub(daiUser)).to.be.bignumber.eq(ether('0').sub(wad));
        expect(debtEnd.sub(debt).div(RAY)).to.be.bignumber.gte(
          ether('0').sub(wad)
        );
        profileGas(receipt);
      });

      it('wipeAll', async function() {
        const to = this.hmaker.address;
        const data = abi.simpleEncode(
          'wipeAll(address,uint256)',
          MAKER_MCD_JOIN_DAI,
          cdp
        );
        await this.dai.transfer(user2, ether('10'), {
          from: DAI_PROVIDER,
        });
        daiUser = await this.dai.balanceOf.call(user2);
        await this.dai.transfer(this.proxy.address, ether('40'), {
          from: user2,
        });
        await this.proxy.updateTokenMock(this.dai.address);
        [ilk, debt, lock] = await getCdpInfo(cdp);
        const receipt = await this.proxy.execMock(to, data, {
          from: user2,
        });
        const [ilkEnd, debtEnd, lockEnd] = await getCdpInfo(cdp);
        const daiUserEnd = await this.dai.balanceOf.call(user2);
        expect(debtEnd).to.be.bignumber.eq(ether('0'));
        expect(daiUser.sub(daiUserEnd)).to.be.bignumber.gte(
          debt.div(RAY).sub(new BN('1'))
        );
        profileGas(receipt);
      });
    });
  });
});
