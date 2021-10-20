const {
  balance,
  BN,
  constants,
  ether,
  expectEvent,
  expectRevert,
  time,
} = require('@openzeppelin/test-helpers');
const { MAX_UINT256 } = constants;
const { tracker } = balance;
const { latest } = time;
const abi = require('ethereumjs-abi');
const utils = web3.utils;
const { ZERO_ADDRESS } = constants;

const { expect } = require('chai');

const {
  LINK_TOKEN,
  LINK_PROVIDER,
  DAI_TOKEN,
  DAI_PROVIDER,
  B_CDP_MANAGER,
  MAKER_PROXY_FACTORY,
  B_PROXY_ACTIONS,
  MAKER_PROXY_REGISTRY,
  MAKER_MCD_JUG,
  MAKER_MCD_VAT,
  MAKER_MCD_JOIN_ETH_A,
  MAKER_MCD_JOIN_LINK_A,
  MAKER_MCD_JOIN_DAI,
} = require('./utils/constants');
const {
  evmRevert,
  evmSnapshot,
  profileGas,
  getHandlerReturn,
} = require('./utils/utils');

const HMaker = artifacts.require('HBProtocol');
const Registry = artifacts.require('Registry');
const Proxy = artifacts.require('ProxyMock');
const IToken = artifacts.require('IERC20');
const IDSProxy = artifacts.require('IDSProxy');
const IDSProxyRegistry = artifacts.require('IDSProxyRegistry');
const IMakerManager = artifacts.require('IMakerManager');
const IMakerVat = artifacts.require('IMakerVat');

const RAY = new BN('1000000000000000000000000000');
const RAD = new BN('1000000000000000000000000000000000000000000000');

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

async function getCdpInfo(cdp) {
  const cdpManager = await IMakerManager.at(B_CDP_MANAGER);
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
    B_CDP_MANAGER,
    cdp,
    user,
    new BN('1')
  );
  await proxy.execute(B_PROXY_ACTIONS, data, { from: owner });
}

contract('BProtocol', function([_, user1, user2, someone]) {
  let id;
  const tokenAddress = LINK_TOKEN;
  const providerAddress = LINK_PROVIDER;
  const makerMcdJoinETH = MAKER_MCD_JOIN_ETH_A;
  const makerMcdJoinETHName = 'ETH-A';
  const makerMcdJoinToken = MAKER_MCD_JOIN_LINK_A;
  const makerMcdJoinTokenName = 'LINK-A';

  before(async function() {
    this.registry = await Registry.new();
    this.proxy = await Proxy.new(this.registry.address);
    this.token = await IToken.at(tokenAddress);
    this.hMaker = await HMaker.new();
    await this.registry.register(
      this.hMaker.address,
      utils.asciiToHex('Maker')
    );
    this.dsRegistry = await IDSProxyRegistry.at(MAKER_PROXY_REGISTRY);
    this.cdpManager = await IMakerManager.at(B_CDP_MANAGER);
    this.vat = await IMakerVat.at(MAKER_MCD_VAT);
    await this.dsRegistry.build(this.proxy.address);

    let dsProxyAddr = await this.dsRegistry.proxies.call(user1);
    if (dsProxyAddr == constants.ZERO_ADDRESS)
      await this.dsRegistry.build(user1);

    dsProxyAddr = await this.dsRegistry.proxies.call(user2);
    if (dsProxyAddr == constants.ZERO_ADDRESS)
      await this.dsRegistry.build(user2);

    this.dsProxy = await IDSProxy.at(
      await this.dsRegistry.proxies.call(this.proxy.address)
    );
    this.user1Proxy = await IDSProxy.at(
      await this.dsRegistry.proxies.call(user1)
    );
    this.user2Proxy = await IDSProxy.at(
      await this.dsRegistry.proxies.call(user2)
    );
    this.dai = await IToken.at(DAI_TOKEN);

    await hre.network.provider.request({
      method: 'hardhat_impersonateAccount',
      params: [DAI_PROVIDER],
    });
    await hre.network.provider.request({
      method: 'hardhat_impersonateAccount',
      params: [LINK_PROVIDER],
    });
  });

  beforeEach(async function() {
    id = await evmSnapshot();
  });

  afterEach(async function() {
    await evmRevert(id);
  });

  describe('Open new cdp', function() {
    let daiUser;

    beforeEach(async function() {
      daiUser = await this.dai.balanceOf.call(user1);
    });

    describe('Lock Ether', function() {
      describe('Draw Dai', function() {
        it('User does not has proxy', async function() {
          const daiUser = await this.dai.balanceOf.call(someone);

          expect(await this.dsRegistry.proxies.call(this.proxy.address)).not.eq(
            ZERO_ADDRESS
          );
          expect(await this.dsRegistry.proxies.call(someone)).eq(ZERO_ADDRESS);

          const to = this.hMaker.address;
          const ilkEth = utils.padRight(
            utils.asciiToHex(makerMcdJoinETHName),
            64
          );
          const [
            generateLimit,
            minCollateral,
          ] = await getGenerateLimitAndMinCollateral(ilkEth);
          const wadD = generateLimit;
          const value = minCollateral;
          const data = abi.simpleEncode(
            'openLockETHAndDraw(uint256,address,address,bytes32,uint256)',
            value,
            makerMcdJoinETH,
            MAKER_MCD_JOIN_DAI,
            ilkEth,
            wadD
          );
          const receipt = await this.proxy.execMock(to, data, {
            from: someone,
            value: value,
          });
          const handlerReturn = utils.toBN(
            getHandlerReturn(receipt, ['uint256'])[0]
          );

          expect(
            await this.cdpManager.count.call(this.dsProxy.address)
          ).to.be.bignumber.eq(new BN('0'));
          const userProxy = await this.dsRegistry.proxies.call(someone);
          const cdp = await this.cdpManager.last.call(userProxy);

          const [ilk, debt, lock] = await getCdpInfo(cdp);

          expect(cdp).to.be.bignumber.eq(handlerReturn);
          expect(ilk).eq(ilkEth);
          expect(debt).to.be.bignumber.gte(wadD.mul(RAY));
          expect(lock).to.be.bignumber.eq(value);
          expect(
            (await this.dai.balanceOf.call(someone)).sub(daiUser)
          ).to.be.bignumber.eq(wadD);
          profileGas(receipt);
        });

        it('User does not has proxy with max amount', async function() {
          const daiUser = await this.dai.balanceOf.call(someone);

          expect(await this.dsRegistry.proxies.call(this.proxy.address)).not.eq(
            ZERO_ADDRESS
          );
          expect(await this.dsRegistry.proxies.call(someone)).eq(ZERO_ADDRESS);

          const to = this.hMaker.address;
          const ilkEth = utils.padRight(
            utils.asciiToHex(makerMcdJoinETHName),
            64
          );
          const [
            generateLimit,
            minCollateral,
          ] = await getGenerateLimitAndMinCollateral(ilkEth);
          const wadD = generateLimit;
          const value = minCollateral;
          const data = abi.simpleEncode(
            'openLockETHAndDraw(uint256,address,address,bytes32,uint256)',
            MAX_UINT256,
            makerMcdJoinETH,
            MAKER_MCD_JOIN_DAI,
            ilkEth,
            wadD
          );
          const receipt = await this.proxy.execMock(to, data, {
            from: someone,
            value: value,
          });
          const handlerReturn = utils.toBN(
            getHandlerReturn(receipt, ['uint256'])[0]
          );

          expect(
            await this.cdpManager.count.call(this.dsProxy.address)
          ).to.be.bignumber.eq(new BN('0'));
          const userProxy = await this.dsRegistry.proxies.call(someone);
          const cdp = await this.cdpManager.last.call(userProxy);

          const [ilk, debt, lock] = await getCdpInfo(cdp);

          expect(cdp).to.be.bignumber.eq(handlerReturn);
          expect(ilk).eq(ilkEth);
          expect(debt).to.be.bignumber.gte(wadD.mul(RAY));
          expect(lock).to.be.bignumber.eq(value);
          expect(
            (await this.dai.balanceOf.call(someone)).sub(daiUser)
          ).to.be.bignumber.eq(wadD);
          profileGas(receipt);
        });

        it('User has proxy', async function() {
          const to = this.hMaker.address;
          const ilkEth = utils.padRight(
            utils.asciiToHex(makerMcdJoinETHName),
            64
          );
          const [
            generateLimit,
            minCollateral,
          ] = await getGenerateLimitAndMinCollateral(ilkEth);
          const wadD = generateLimit;
          const value = minCollateral;
          const data = abi.simpleEncode(
            'openLockETHAndDraw(uint256,address,address,bytes32,uint256)',
            value,
            makerMcdJoinETH,
            MAKER_MCD_JOIN_DAI,
            ilkEth,
            wadD
          );
          const receipt = await this.proxy.execMock(to, data, {
            from: user1,
            value: value,
          });
          const handlerReturn = utils.toBN(
            getHandlerReturn(receipt, ['uint256'])[0]
          );
          expect(
            await this.cdpManager.count.call(this.dsProxy.address)
          ).to.be.bignumber.eq(new BN('0'));
          const userProxy = await this.dsRegistry.proxies.call(user1);
          const cdp = await this.cdpManager.last.call(userProxy);

          const [ilk, debt, lock] = await getCdpInfo(cdp);

          expect(cdp).to.be.bignumber.eq(handlerReturn);
          expect(ilk).eq(ilkEth);
          expect(debt).to.be.bignumber.gte(wadD.mul(RAY));
          expect(lock).to.be.bignumber.eq(value);
          expect(
            (await this.dai.balanceOf.call(user1)).sub(daiUser)
          ).to.be.bignumber.eq(wadD);
          profileGas(receipt);
        });

        it('User has proxy with max amount', async function() {
          const to = this.hMaker.address;
          const ilkEth = utils.padRight(
            utils.asciiToHex(makerMcdJoinETHName),
            64
          );
          const [
            generateLimit,
            minCollateral,
          ] = await getGenerateLimitAndMinCollateral(ilkEth);
          const wadD = generateLimit;
          const value = minCollateral;
          const data = abi.simpleEncode(
            'openLockETHAndDraw(uint256,address,address,bytes32,uint256)',
            MAX_UINT256,
            makerMcdJoinETH,
            MAKER_MCD_JOIN_DAI,
            ilkEth,
            wadD
          );
          const receipt = await this.proxy.execMock(to, data, {
            from: user1,
            value: value,
          });
          const handlerReturn = utils.toBN(
            getHandlerReturn(receipt, ['uint256'])[0]
          );
          expect(
            await this.cdpManager.count.call(this.dsProxy.address)
          ).to.be.bignumber.eq(new BN('0'));
          const userProxy = await this.dsRegistry.proxies.call(user1);
          const cdp = await this.cdpManager.last.call(userProxy);

          const [ilk, debt, lock] = await getCdpInfo(cdp);

          expect(cdp).to.be.bignumber.eq(handlerReturn);
          expect(ilk).eq(ilkEth);
          expect(debt).to.be.bignumber.gte(wadD.mul(RAY));
          expect(lock).to.be.bignumber.eq(value);
          expect(
            (await this.dai.balanceOf.call(user1)).sub(daiUser)
          ).to.be.bignumber.eq(wadD);
          profileGas(receipt);
        });
      });
    });

    describe('Lock Token', function() {
      describe('Draw Dai', function() {
        it('User does not has proxy', async function() {
          const daiUser = await this.dai.balanceOf.call(someone);

          expect(await this.dsRegistry.proxies.call(this.proxy.address)).not.eq(
            ZERO_ADDRESS
          );
          expect(await this.dsRegistry.proxies.call(someone)).eq(ZERO_ADDRESS);

          const to = this.hMaker.address;
          const ilkToken = utils.padRight(
            utils.asciiToHex(makerMcdJoinTokenName),
            64
          );
          const [
            generateLimit,
            minCollateral,
          ] = await getGenerateLimitAndMinCollateral(ilkToken);
          const wadD = generateLimit;
          const wadC = minCollateral;
          const data = abi.simpleEncode(
            'openLockGemAndDraw(address,address,bytes32,uint256,uint256)',
            makerMcdJoinToken,
            MAKER_MCD_JOIN_DAI,
            ilkToken,
            wadC,
            wadD
          );
          await this.token.transfer(this.proxy.address, wadC, {
            from: providerAddress,
          });
          await this.proxy.updateTokenMock(this.token.address);
          const receipt = await this.proxy.execMock(to, data, {
            from: someone,
            value: ether('1'),
          });
          const handlerReturn = utils.toBN(
            getHandlerReturn(receipt, ['uint256'])[0]
          );

          expect(
            await this.cdpManager.count.call(this.dsProxy.address)
          ).to.be.bignumber.eq(new BN('0'));
          const userProxy = await this.dsRegistry.proxies.call(someone);
          const cdp = await this.cdpManager.last.call(userProxy);

          const [ilk, debt, lock] = await getCdpInfo(cdp);

          expect(cdp).to.be.bignumber.eq(handlerReturn);
          expect(ilk).eq(ilkToken);
          expect(debt).to.be.bignumber.gte(wadD.mul(RAY));
          expect(lock).to.be.bignumber.eq(wadC);
          expect(
            (await this.dai.balanceOf.call(someone)).sub(daiUser)
          ).to.be.bignumber.eq(wadD);
          profileGas(receipt);
        });

        it('User has proxy', async function() {
          const to = this.hMaker.address;
          const ilkToken = utils.padRight(
            utils.asciiToHex(makerMcdJoinTokenName),
            64
          );
          const [
            generateLimit,
            minCollateral,
          ] = await getGenerateLimitAndMinCollateral(ilkToken);
          const wadC = minCollateral;
          const wadD = generateLimit;
          const data = abi.simpleEncode(
            'openLockGemAndDraw(address,address,bytes32,uint256,uint256)',
            makerMcdJoinToken,
            MAKER_MCD_JOIN_DAI,
            ilkToken,
            wadC,
            wadD
          );
          await this.token.transfer(this.proxy.address, wadC, {
            from: providerAddress,
          });
          await this.proxy.updateTokenMock(this.token.address);
          const receipt = await this.proxy.execMock(to, data, {
            from: user1,
            value: ether('1'),
          });
          const handlerReturn = utils.toBN(
            getHandlerReturn(receipt, ['uint256'])[0]
          );
          expect(
            await this.cdpManager.count.call(this.dsProxy.address)
          ).to.be.bignumber.eq(new BN('0'));
          const userProxy = await this.dsRegistry.proxies.call(user1);
          const cdp = await this.cdpManager.last.call(userProxy);

          const [ilk, debt, lock] = await getCdpInfo(cdp);

          expect(cdp).to.be.bignumber.eq(handlerReturn);
          expect(ilk).eq(ilkToken);
          expect(debt).to.be.bignumber.gte(wadD.mul(RAY));
          expect(lock).to.be.bignumber.eq(wadC);
          expect(
            (await this.dai.balanceOf.call(user1)).sub(daiUser)
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
        B_CDP_MANAGER,
        utils.padRight(utils.asciiToHex(makerMcdJoinETHName), 64),
        this.user1Proxy.address
      );
      const new2 = abi.simpleEncode(
        'open(address,bytes32,address)',
        B_CDP_MANAGER,
        utils.padRight(utils.asciiToHex(makerMcdJoinTokenName), 64),
        this.user2Proxy.address
      );
      await this.user1Proxy.execute(B_PROXY_ACTIONS, new1, { from: user1 });
      await this.user2Proxy.execute(B_PROXY_ACTIONS, new2, { from: user2 });
    });

    describe('Lock Ether', function() {
      let balanceUser;
      before(async function() {
        cdp = await this.cdpManager.last.call(this.user1Proxy.address);
        expect(cdp).to.be.bignumber.not.eq(new BN('0'));
      });

      beforeEach(async function() {
        balanceUser = await tracker(user1);
        [ilk, debt, lock] = await getCdpInfo(cdp);
      });

      it('normal', async function() {
        const to = this.hMaker.address;
        const value = ether('1');
        const data = abi.simpleEncode(
          'safeLockETH(uint256,address,uint256)',
          value,
          makerMcdJoinETH,
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
      it('max amount', async function() {
        const to = this.hMaker.address;
        const value = ether('1');
        const data = abi.simpleEncode(
          'safeLockETH(uint256,address,uint256)',
          MAX_UINT256,
          makerMcdJoinETH,
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
      before(async function() {
        cdp = await this.cdpManager.last.call(this.user2Proxy.address);
        expect(cdp).to.be.bignumber.not.eq(new BN('0'));
      });

      beforeEach(async function() {
        balanceUser = await tracker(user2);
        [ilk, debt, lock] = await getCdpInfo(cdp);
        tokenUser = await this.token.balanceOf.call(user2);
      });

      it('normal', async function() {
        const to = this.hMaker.address;
        const [
          generateLimit,
          minCollateral,
        ] = await getGenerateLimitAndMinCollateral(
          utils.padRight(utils.asciiToHex(makerMcdJoinTokenName), 64)
        );
        const wad = generateLimit;
        const data = abi.simpleEncode(
          'safeLockGem(address,uint256,uint256)',
          makerMcdJoinToken,
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

      it('max amount', async function() {
        const to = this.hMaker.address;
        const [
          generateLimit,
          minCollateral,
        ] = await getGenerateLimitAndMinCollateral(
          utils.padRight(utils.asciiToHex(makerMcdJoinTokenName), 64)
        );
        const wad = generateLimit;
        const data = abi.simpleEncode(
          'safeLockGem(address,uint256,uint256)',
          makerMcdJoinToken,
          cdp,
          MAX_UINT256
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
          B_CDP_MANAGER,
          MAKER_MCD_JUG,
          makerMcdJoinETH,
          MAKER_MCD_JOIN_DAI,
          utils.padRight(utils.asciiToHex(makerMcdJoinETHName), 64),
          ether('0')
        );
        await this.user1Proxy.execute(B_PROXY_ACTIONS, new1, {
          from: user1,
          value: etherAmount,
        });
        cdp = await this.cdpManager.last.call(this.user1Proxy.address);
        balanceUser = await tracker(user1);
        [ilk, debt, lock] = await getCdpInfo(cdp);
      });

      it('normal', async function() {
        await approveCdp(cdp, user1, this.dsProxy.address);
        balanceUser = await tracker(user1);
        const to = this.hMaker.address;
        const wad = ether('1');
        const data = abi.simpleEncode(
          'freeETH(address,uint256,uint256)',
          makerMcdJoinETH,
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
        const to = this.hMaker.address;
        const wad = ether('1');
        const data = abi.simpleEncode(
          'freeETH(address,uint256,uint256)',
          makerMcdJoinETH,
          cdp,
          wad
        );
        await expectRevert(
          this.proxy.execMock(to, data, {
            from: user1,
          }),
          'HBProtocol_freeETH: Unspecified'
        );
      });

      it('approved but triggered by unauthorized user', async function() {
        await approveCdp(cdp, user1, this.dsProxy.address);
        balanceUser = await tracker(user1);
        const to = this.hMaker.address;
        const wad = ether('1');
        const data = abi.simpleEncode(
          'freeETH(address,uint256,uint256)',
          makerMcdJoinETH,
          cdp,
          wad
        );
        await expectRevert(
          this.proxy.execMock(to, data),
          'HBProtocol_General: Unauthorized sender of cdp'
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
          B_CDP_MANAGER,
          MAKER_MCD_JUG,
          makerMcdJoinToken,
          MAKER_MCD_JOIN_DAI,
          utils.padRight(utils.asciiToHex(makerMcdJoinTokenName), 64),
          tokenAmount,
          ether('0'),
          true
        );
        await this.token.transfer(user1, tokenAmount, {
          from: providerAddress,
        });
        await this.token.approve(this.user1Proxy.address, tokenAmount, {
          from: user1,
        });
        await this.user1Proxy.execute(B_PROXY_ACTIONS, new2, {
          from: user1,
        });
        cdp = await this.cdpManager.last.call(this.user1Proxy.address);
        tokenUser = await this.token.balanceOf.call(user1);
        [ilk, debt, lock] = await getCdpInfo(cdp);
      });

      it('normal', async function() {
        await approveCdp(cdp, user1, this.dsProxy.address);
        const to = this.hMaker.address;
        const wad = ether('100');
        const data = abi.simpleEncode(
          'freeGem(address,uint256,uint256)',
          makerMcdJoinToken,
          cdp,
          wad
        );
        const receipt = await this.proxy.execMock(to, data, {
          from: user1,
        });
        const [ilkEnd, debtEnd, lockEnd] = await getCdpInfo(cdp);
        const tokenUserEnd = await this.token.balanceOf.call(user1);
        expect(tokenUserEnd.sub(tokenUser)).to.be.bignumber.eq(wad);
        expect(lockEnd.sub(lock)).to.be.bignumber.eq(ether('0').sub(wad));
        profileGas(receipt);
      });

      it('without cdp approval', async function() {
        const to = this.hMaker.address;
        const wad = ether('100');
        const data = abi.simpleEncode(
          'freeGem(address,uint256,uint256)',
          makerMcdJoinToken,
          cdp,
          wad
        );
        await expectRevert(
          this.proxy.execMock(to, data, {
            from: user1,
          }),
          'HBProtocol_freeGem: Unspecified'
        );
      });

      it('approved but triggered by unauthorized user', async function() {
        await approveCdp(cdp, user1, this.dsProxy.address);
        const to = this.hMaker.address;
        const wad = ether('100');
        const data = abi.simpleEncode(
          'freeGem(address,uint256,uint256)',
          makerMcdJoinToken,
          cdp,
          wad
        );
        await expectRevert(
          this.proxy.execMock(to, data),
          'HBProtocol_General: Unauthorized sender of cdp'
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
        const etherAmount = ether('10');
        const new1 = abi.simpleEncode(
          'openLockETHAndDraw(address,address,address,address,bytes32,uint256)',
          B_CDP_MANAGER,
          MAKER_MCD_JUG,
          makerMcdJoinETH,
          MAKER_MCD_JOIN_DAI,
          utils.padRight(utils.asciiToHex(makerMcdJoinETHName), 64),
          ether('0')
        );
        await this.user1Proxy.execute(B_PROXY_ACTIONS, new1, {
          from: user1,
          value: etherAmount,
        });
        cdp = await this.cdpManager.last.call(this.user1Proxy.address);
        daiUser = await this.dai.balanceOf.call(user1);
        [ilk, debt, lock] = await getCdpInfo(cdp);
      });

      it('normal', async function() {
        await approveCdp(cdp, user1, this.dsProxy.address);
        const to = this.hMaker.address;
        const [
          generateLimit,
          minCollateral,
        ] = await getGenerateLimitAndMinCollateral(
          utils.padRight(utils.asciiToHex(makerMcdJoinETHName), 64)
        );
        const wad = generateLimit;
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
        const to = this.hMaker.address;
        const [
          generateLimit,
          minCollateral,
        ] = await getGenerateLimitAndMinCollateral(
          utils.padRight(utils.asciiToHex(makerMcdJoinTokenName), 64)
        );
        const wad = generateLimit;
        const data = abi.simpleEncode(
          'draw(address,uint256,uint256)',
          MAKER_MCD_JOIN_DAI,
          cdp,
          wad
        );
        await expectRevert(
          this.proxy.execMock(to, data, {
            from: user1,
          }),
          'HBProtocol_draw: Unspecified'
        );
      });

      it('approved but triggered by unauthorized user', async function() {
        await approveCdp(cdp, user1, this.dsProxy.address);
        const to = this.hMaker.address;
        const [
          generateLimit,
          minCollateral,
        ] = await getGenerateLimitAndMinCollateral(
          utils.padRight(utils.asciiToHex(makerMcdJoinTokenName), 64)
        );
        const wad = generateLimit;
        const data = abi.simpleEncode(
          'draw(address,uint256,uint256)',
          MAKER_MCD_JOIN_DAI,
          cdp,
          wad
        );
        await expectRevert(
          this.proxy.execMock(to, data),
          'HBProtocol_General: Unauthorized sender of cdp'
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
        const [
          generateLimit,
          minCollateral,
        ] = await getGenerateLimitAndMinCollateral(
          utils.padRight(utils.asciiToHex(makerMcdJoinTokenName), 64)
        );
        const tokenAmount = minCollateral;
        const new2 = abi.simpleEncode(
          'openLockGemAndDraw(address,address,address,address,bytes32,uint256,uint256,bool)',
          B_CDP_MANAGER,
          MAKER_MCD_JUG,
          makerMcdJoinToken,
          MAKER_MCD_JOIN_DAI,
          utils.padRight(utils.asciiToHex(makerMcdJoinTokenName), 64),
          tokenAmount,
          ether('0'),
          true
        );
        await this.token.transfer(user1, tokenAmount, {
          from: providerAddress,
        });
        await this.token.approve(this.user1Proxy.address, tokenAmount, {
          from: user1,
        });
        await this.user1Proxy.execute(B_PROXY_ACTIONS, new2, {
          from: user1,
        });
        cdp = await this.cdpManager.last.call(this.user1Proxy.address);
        daiUser = await this.dai.balanceOf.call(user1);
        [ilk, debt, lock] = await getCdpInfo(cdp);
      });

      it('normal', async function() {
        await approveCdp(cdp, user1, this.dsProxy.address);
        const to = this.hMaker.address;
        const [
          generateLimit,
          minCollateral,
        ] = await getGenerateLimitAndMinCollateral(
          utils.padRight(utils.asciiToHex(makerMcdJoinETHName), 64)
        );
        const wad = generateLimit;
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
        const to = this.hMaker.address;
        const [
          generateLimit,
          minCollateral,
        ] = await getGenerateLimitAndMinCollateral(
          utils.padRight(utils.asciiToHex(makerMcdJoinTokenName), 64)
        );
        const wad = generateLimit;
        const data = abi.simpleEncode(
          'draw(address,uint256,uint256)',
          MAKER_MCD_JOIN_DAI,
          cdp,
          wad
        );
        await expectRevert(
          this.proxy.execMock(to, data, {
            from: user1,
          }),
          'HBProtocol_draw: Unspecified'
        );
      });

      it('approved but triggered by unauthorized user', async function() {
        await approveCdp(cdp, user1, this.dsProxy.address);
        const to = this.hMaker.address;
        const [
          generateLimit,
          minCollateral,
        ] = await getGenerateLimitAndMinCollateral(
          utils.padRight(utils.asciiToHex(makerMcdJoinTokenName), 64)
        );
        const wad = generateLimit;
        const data = abi.simpleEncode(
          'draw(address,uint256,uint256)',
          MAKER_MCD_JOIN_DAI,
          cdp,
          wad
        );
        await expectRevert(
          this.proxy.execMock(to, data),
          'HBProtocol_General: Unauthorized sender of cdp'
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
      let generateLimit;
      let minCollateral;

      beforeEach(async function() {
        const etherAmount = ether('10');
        [generateLimit, minCollateral] = await getGenerateLimitAndMinCollateral(
          utils.padRight(utils.asciiToHex(makerMcdJoinETHName), 64)
        );
        const daiAmount = generateLimit.add(ether('10'));
        const new1 = abi.simpleEncode(
          'openLockETHAndDraw(address,address,address,address,bytes32,uint256)',
          B_CDP_MANAGER,
          MAKER_MCD_JUG,
          makerMcdJoinETH,
          MAKER_MCD_JOIN_DAI,
          utils.padRight(utils.asciiToHex(makerMcdJoinETHName), 64),
          daiAmount
        );
        await this.user1Proxy.execute(B_PROXY_ACTIONS, new1, {
          from: user1,
          value: etherAmount,
        });
        cdp = await this.cdpManager.last.call(this.user1Proxy.address);
        daiUser = await this.dai.balanceOf.call(user1);
        [ilk, debt, lock] = await getCdpInfo(cdp);
      });

      it('wipe', async function() {
        const to = this.hMaker.address;
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
        const to = this.hMaker.address;
        const data = abi.simpleEncode(
          'wipeAll(address,uint256)',
          MAKER_MCD_JOIN_DAI,
          cdp
        );
        await this.dai.transfer(user1, ether('20'), {
          from: DAI_PROVIDER,
        });
        daiUser = await this.dai.balanceOf.call(user1);
        await this.dai.transfer(
          this.proxy.address,
          generateLimit.add(ether('20')),
          {
            from: user1,
          }
        );
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
        const [
          generateLimit,
          minCollateral,
        ] = await getGenerateLimitAndMinCollateral(
          utils.padRight(utils.asciiToHex(makerMcdJoinTokenName), 64)
        );
        const tokenAmount = minCollateral;
        const daiAmount = generateLimit.add(ether('10'));

        const new2 = abi.simpleEncode(
          'openLockGemAndDraw(address,address,address,address,bytes32,uint256,uint256,bool)',
          B_CDP_MANAGER,
          MAKER_MCD_JUG,
          makerMcdJoinToken,
          MAKER_MCD_JOIN_DAI,
          utils.padRight(utils.asciiToHex(makerMcdJoinTokenName), 64),
          tokenAmount,
          daiAmount,
          true
        );
        await this.token.transfer(user1, tokenAmount, {
          from: providerAddress,
        });
        await this.token.approve(this.user1Proxy.address, tokenAmount, {
          from: user1,
        });
        await this.user1Proxy.execute(B_PROXY_ACTIONS, new2, {
          from: user1,
        });
        cdp = await this.cdpManager.last.call(this.user1Proxy.address);
        daiUser = await this.dai.balanceOf.call(user1);
        [ilk, debt, lock] = await getCdpInfo(cdp);
      });

      it('wipe', async function() {
        const to = this.hMaker.address;
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
        const to = this.hMaker.address;
        const data = abi.simpleEncode(
          'wipeAll(address,uint256)',
          MAKER_MCD_JOIN_DAI,
          cdp
        );
        await this.dai.transfer(user1, ether('20'), {
          from: DAI_PROVIDER,
        });
        daiUser = await this.dai.balanceOf.call(user1);
        const [
          generateLimit,
          minCollateral,
        ] = await getGenerateLimitAndMinCollateral(
          utils.padRight(utils.asciiToHex(makerMcdJoinTokenName), 64)
        );
        const wad = generateLimit;
        await this.dai.transfer(
          this.proxy.address,
          generateLimit.add(ether('20')),
          {
            from: user1,
          }
        );
        await this.proxy.updateTokenMock(this.dai.address);
        [ilk, debt, lock] = await getCdpInfo(cdp);
        const receipt = await this.proxy.execMock(to, data, {
          from: user1,
        });
        const [ilkEnd, debtEnd, lockEnd] = await getCdpInfo(cdp);
        const daiUserEnd = await this.dai.balanceOf.call(user1);
        expect(debtEnd).to.be.bignumber.eq(ether('0'));
        expect(daiUser.sub(daiUserEnd)).to.be.bignumber.gte(
          debt.div(RAY).sub(new BN('1'))
        );
        profileGas(receipt);
      });
    });
  });
});
