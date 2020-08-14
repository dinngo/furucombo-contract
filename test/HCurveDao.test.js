const { BN, ether, expectRevert, time } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');
const abi = require('ethereumjs-abi');
const utils = web3.utils;
const { increase, duration } = time;
const {
  CRV_TOKEN,
  CURVE_YCRV,
  CURVE_YCRV_PROVIDER,
  CURVE_YCRV_GAUGE,
  CURVE_TCRV,
  CURVE_TCRV_PROVIDER,
  CURVE_TCRV_GAUGE,
  CURVE_MINTER,
} = require('./utils/constants');
const { resetAccount, profileGas } = require('./utils/utils');

const Proxy = artifacts.require('ProxyMock');
const Registry = artifacts.require('Registry');
const HCurveDao = artifacts.require('HCurveDao');
const IMinter = artifacts.require('IMinter');
const ILiquidityGauge = artifacts.require('ILiquidityGauge');
const IToken = artifacts.require('IERC20');

contract('Curve DAO', function([_, deployer, user1, user2]) {
  // Wait for the gaude to be ready
  const token0Address = CURVE_YCRV;
  const token1Address = CURVE_TCRV;
  const token0Provider = CURVE_YCRV_PROVIDER;
  const token1Provider = CURVE_TCRV_PROVIDER;
  const gauge0Address = CURVE_YCRV_GAUGE;
  const gauge1Address = CURVE_TCRV_GAUGE;
  const gauge0Amount = ether('0.1');
  const gauge1Amount = ether('0.1');

  before(async function() {
    this.minter = await IMinter.at(CURVE_MINTER);
    this.registry = await Registry.new();
    this.hcurvedao = await HCurveDao.new();
    await this.registry.register(
      this.hcurvedao.address,
      utils.asciiToHex('HCurveDao')
    );
    this.crv = await IToken.at(CRV_TOKEN);
    this.token0 = await IToken.at(token0Address);
    this.token1 = await IToken.at(token1Address);
    this.gauge0 = await ILiquidityGauge.at(gauge0Address);
    this.gauge1 = await ILiquidityGauge.at(gauge1Address);
  });

  beforeEach(async function() {
    await resetAccount(_);
    await resetAccount(user1);
    await resetAccount(user2);
    this.proxy = await Proxy.new(this.registry.address);
  });

  describe('Deposit lp token to gauge', function() {
    it('normal', async function() {
      await this.token0.transfer(this.proxy.address, gauge0Amount, {
        from: token0Provider,
      });
      const to = this.hcurvedao.address;
      const data = abi.simpleEncode(
        'deposit(address,uint256)',
        this.gauge0.address,
        gauge0Amount
      );
      await this.gauge0.set_approve_deposit(this.proxy.address, true, {
        from: user1,
      });

      const depositUser1 = await this.gauge0.balanceOf.call(user1);
      const receipt = await this.proxy.execMock(to, data, {
        from: user1,
        value: ether('0.1'),
      });
      const depositUser1End = await this.gauge0.balanceOf.call(user1);
      expect(depositUser1End.sub(depositUser1)).to.be.bignumber.eq(
        gauge0Amount
      );
    });

    it('without approval', async function() {
      await this.token0.transfer(this.proxy.address, gauge0Amount, {
        from: token0Provider,
      });
      const to = this.hcurvedao.address;
      const data = abi.simpleEncode(
        'deposit(address,uint256)',
        this.gauge0.address,
        gauge0Amount
      );
      await expectRevert.unspecified(
        this.proxy.execMock(to, data, {
          from: user1,
          value: ether('0.1'),
        })
      );
    });
  });

  describe('Claim CRV', function() {
    describe('from single gauge', function() {
      beforeEach(async function() {
        await this.token0.transfer(user1, gauge0Amount, {
          from: token0Provider,
        });
        await this.token0.approve(this.gauge0.address, gauge0Amount, {
          from: user1,
        });
        await this.gauge0.deposit(gauge0Amount, user1, { from: user1 });
        await increase(duration.days('30'));
      });

      afterEach(async function() {
        const rest0 = await this.gauge0.balanceOf.call(user1);
        await this.minter.mint(this.gauge0.address, { from: user1 });
        await this.gauge0.withdraw(rest0, { from: user1 });
        await this.token0.approve(this.gauge0.address, ether('0'), {
          from: user1,
        });
      });

      it('normal', async function() {
        await this.minter.toggle_approve_mint(this.proxy.address, {
          from: user1,
        });
        const to = this.hcurvedao.address;
        const data = abi.simpleEncode('mint(address)', this.gauge0.address);
        const claimableToken = await this.gauge0.claimable_tokens.call(user1);
        const receipt = await this.proxy.execMock(to, data, {
          from: user1,
          value: ether('0.1'),
        });

        expect(await this.crv.balanceOf.call(user1)).to.be.bignumber.gte(
          claimableToken
        );
      });

      it('without approval', async function() {
        const to = this.hcurvedao.address;
        const data = abi.simpleEncode('mint(address)', this.gauge0.address);
        await expectRevert.unspecified(
          this.proxy.execMock(to, data, {
            from: user1,
            value: ether('0.1'),
          })
        );
      });
    });

    describe('from multiple gauges', function() {
      beforeEach(async function() {
        await this.token0.transfer(user2, gauge0Amount, {
          from: token0Provider,
        });
        await this.token1.transfer(user2, gauge1Amount, {
          from: token1Provider,
        });
        await this.token0.approve(this.gauge0.address, gauge0Amount, {
          from: user2,
        });
        await this.token1.approve(this.gauge1.address, gauge1Amount, {
          from: user2,
        });
        await this.gauge0.deposit(gauge0Amount, user2, { from: user2 });
        await this.gauge1.deposit(gauge1Amount, user2, { from: user2 });
      });

      afterEach(async function() {
        const rest0 = await this.gauge0.balanceOf.call(user2);
        const rest1 = await this.gauge0.balanceOf.call(user2);
        await this.minter.mint(this.gauge0.address, { from: user2 });
        await this.minter.mint(this.gauge1.address, { from: user2 });
        await this.gauge0.withdraw(rest0, { from: user2 });
        await this.gauge1.withdraw(rest1, { from: user2 });
        await this.token0.approve(this.gauge0.address, ether('0'), {
          from: user2,
        });
        await this.token1.approve(this.gauge1.address, ether('0'), {
          from: user2,
        });
      });

      it('normal', async function() {
        await this.minter.toggle_approve_mint(this.proxy.address, {
          from: user2,
        });
        const to = this.hcurvedao.address;
        const data = abi.simpleEncode('mint_many(address[])', [
          this.gauge0.address,
          this.gauge1.address,
        ]);
        const claimableToken0 = await this.gauge0.claimable_tokens.call(user2);
        const claimableToken1 = await this.gauge1.claimable_tokens.call(user2);
        const receipt = await this.proxy.execMock(to, data, {
          from: user2,
          value: ether('0.1'),
        });

        expect(await this.crv.balanceOf.call(user2)).to.be.bignumber.gte(
          claimableToken0.add(claimableToken1)
        );
      });

      it('without approval', async function() {
        const to = this.hcurvedao.address;
        const data = abi.simpleEncode('mint_many(address[])', [
          this.gauge0.address,
          this.gauge1.address,
        ]);
        await expectRevert.unspecified(
          this.proxy.execMock(to, data, {
            from: user2,
            value: ether('0.1'),
          })
        );
      });
    });
  });
});
