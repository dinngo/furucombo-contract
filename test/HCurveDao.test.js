const {
  ether,
  expectRevert,
  time,
  constants,
} = require('@openzeppelin/test-helpers');
const { MAX_UINT256 } = constants;
const { expect } = require('chai');
const abi = require('ethereumjs-abi');
const utils = web3.utils;
const { increase, duration } = time;
const {
  CRV_TOKEN,
  CURVE_YCRV,
  CURVE_YCRV_GAUGE,
  CURVE_TCRV,
  CURVE_TCRV_GAUGE,
  CURVE_AAVECRV,
  CURVE_AAVE_GAUGE,
  CURVE_MINTER,
} = require('./utils/constants');
const {
  evmRevert,
  evmSnapshot,
  profileGas,
  getHandlerReturn,
  hasFuncSig,
  tokenProviderCurveGauge,
} = require('./utils/utils');

const Proxy = artifacts.require('ProxyMock');
const Registry = artifacts.require('Registry');
const HCurveDao = artifacts.require('HCurveDao');
const IMinter = artifacts.require('IMinter');
const ILiquidityGauge = artifacts.require('ILiquidityGauge');
const IToken = artifacts.require('IERC20');

contract('Curve DAO', function([_, user]) {
  let id;
  // Wait for the gaude to be ready
  const token0Address = CURVE_YCRV;
  const token1Address = CURVE_TCRV;
  const token2Address = CURVE_AAVECRV;
  const gauge0Address = CURVE_YCRV_GAUGE;
  const gauge1Address = CURVE_TCRV_GAUGE;
  const gauge2Address = CURVE_AAVE_GAUGE;
  const gauge0Amount = ether('0.1');
  const gauge1Amount = ether('0.1');
  const gauge2Amount = ether('0.1');
  const setApproveDepositSig = web3.eth.abi.encodeFunctionSignature(
    'set_approve_deposit(address,bool)'
  );

  let token0Provider;
  let token1Provider;
  let token2Provider;

  before(async function() {
    token0Provider = await tokenProviderCurveGauge(token0Address);
    token1Provider = await tokenProviderCurveGauge(token1Address);
    token2Provider = await tokenProviderCurveGauge(token2Address);

    this.minter = await IMinter.at(CURVE_MINTER);
    this.registry = await Registry.new();
    this.hCurveDao = await HCurveDao.new();
    await this.registry.register(
      this.hCurveDao.address,
      utils.asciiToHex('HCurveDao')
    );
    this.crv = await IToken.at(CRV_TOKEN);
    this.token0 = await IToken.at(token0Address);
    this.token1 = await IToken.at(token1Address);
    this.token2 = await IToken.at(token2Address);
    this.gauge0 = await ILiquidityGauge.at(gauge0Address);
    this.gauge1 = await ILiquidityGauge.at(gauge1Address);
    this.gauge2 = await ILiquidityGauge.at(gauge2Address);
    this.proxy = await Proxy.new(this.registry.address);
  });

  beforeEach(async function() {
    id = await evmSnapshot();
  });

  afterEach(async function() {
    await evmRevert(id);
  });

  describe('Deposit lp token to gauge', function() {
    it('normal', async function() {
      await this.token0.transfer(this.proxy.address, gauge0Amount, {
        from: token0Provider,
      });
      const to = this.hCurveDao.address;
      const data = abi.simpleEncode(
        'deposit(address,uint256)',
        this.gauge0.address,
        gauge0Amount
      );

      if (await hasFuncSig(this.gauge0.address, setApproveDepositSig)) {
        // Only v1 and v2 gauges need deposit approval
        await this.gauge0.set_approve_deposit(this.proxy.address, true, {
          from: user,
        });
      }

      const depositUser = await this.gauge0.balanceOf.call(user);
      const receipt = await this.proxy.execMock(to, data, {
        from: user,
        value: ether('0.1'),
      });

      const depositUserEnd = await this.gauge0.balanceOf.call(user);
      expect(depositUserEnd.sub(depositUser)).to.be.bignumber.eq(gauge0Amount);
      expect(
        await this.token0.balanceOf.call(this.proxy.address)
      ).to.be.bignumber.eq(ether('0'));
      profileGas(receipt);
    });

    it('max amount', async function() {
      await this.token0.transfer(this.proxy.address, gauge0Amount, {
        from: token0Provider,
      });
      const to = this.hCurveDao.address;
      const data = abi.simpleEncode(
        'deposit(address,uint256)',
        this.gauge0.address,
        MAX_UINT256
      );

      if (await hasFuncSig(this.gauge0.address, setApproveDepositSig)) {
        // Only v1 and v2 gauges need deposit approval
        await this.gauge0.set_approve_deposit(this.proxy.address, true, {
          from: user,
        });
      }

      const depositUser = await this.gauge0.balanceOf.call(user);
      const receipt = await this.proxy.execMock(to, data, {
        from: user,
        value: ether('0.1'),
      });

      const depositUserEnd = await this.gauge0.balanceOf.call(user);
      expect(depositUserEnd.sub(depositUser)).to.be.bignumber.eq(gauge0Amount);
      expect(
        await this.token0.balanceOf.call(this.proxy.address)
      ).to.be.bignumber.eq(ether('0'));
      profileGas(receipt);
    });

    it('without approval', async function() {
      if (!(await hasFuncSig(this.gauge0.address, setApproveDepositSig))) {
        // V3 gauges afterwards skip this
        this.skip();
      }

      await this.token0.transfer(this.proxy.address, gauge0Amount, {
        from: token0Provider,
      });
      const to = this.hCurveDao.address;
      const data = abi.simpleEncode(
        'deposit(address,uint256)',
        this.gauge0.address,
        gauge0Amount
      );
      await expectRevert(
        this.proxy.execMock(to, data, {
          from: user,
          value: ether('0.1'),
        }),
        'HCurveDao_deposit: Not approved'
      );
    });
  });

  describe('Withdraw lp token from v2 gauge afterwards', function() {
    let withdrawUser;
    let receipt;

    beforeEach(async function() {
      // Transfer gauge token to furucombo proxy
      await this.token2.transfer(user, gauge2Amount, {
        from: token2Provider,
      });
      await this.token2.approve(this.gauge2.address, gauge2Amount, {
        from: user,
      });
      await this.gauge2.deposit(gauge2Amount, user, {
        from: user,
      });
      await this.gauge2.transfer(this.proxy.address, gauge2Amount, {
        from: user,
      });
    });

    it('normal', async function() {
      const to = this.hCurveDao.address;
      const data = abi.simpleEncode(
        'withdraw(address,uint256)',
        this.gauge2.address,
        gauge2Amount
      );
      withdrawUser = await this.token2.balanceOf(user);
      receipt = await this.proxy.execMock(to, data, {
        from: user,
        value: ether('0.1'),
      });
    });

    it('max amount', async function() {
      const to = this.hCurveDao.address;
      const data = abi.simpleEncode(
        'withdraw(address,uint256)',
        this.gauge2.address,
        MAX_UINT256
      );
      withdrawUser = await this.token2.balanceOf(user);
      receipt = await this.proxy.execMock(to, data, {
        from: user,
        value: ether('0.1'),
      });
    });

    afterEach(async function() {
      const withdrawUserEnd = await this.token2.balanceOf(user);

      // Check handler return
      const handlerReturn = utils.toBN(
        getHandlerReturn(receipt, ['uint256'])[0]
      );
      expect(handlerReturn).to.be.bignumber.eq(gauge2Amount);

      // Check lp amount
      expect(withdrawUserEnd.sub(withdrawUser)).to.be.bignumber.eq(
        gauge2Amount
      );
      expect(
        await this.token2.balanceOf(this.proxy.address)
      ).to.be.bignumber.eq(ether('0'));

      // Check gauge token amount
      expect(await this.gauge2.balanceOf(user)).to.be.bignumber.eq(ether('0'));
      expect(
        await this.gauge2.balanceOf(this.proxy.address)
      ).to.be.bignumber.eq(ether('0'));

      profileGas(receipt);
    });
  });

  describe('Claim CRV', function() {
    let crvUser;
    describe('from single gauge', function() {
      beforeEach(async function() {
        await this.token0.transfer(user, gauge0Amount, {
          from: token0Provider,
        });
        await this.token0.approve(this.gauge0.address, gauge0Amount, {
          from: user,
        });
        await this.gauge0.deposit(gauge0Amount, user, { from: user });
        await increase(duration.days('30'));
        crvUser = await this.crv.balanceOf.call(user);
      });

      afterEach(async function() {
        const rest0 = await this.gauge0.balanceOf.call(user);
        await this.gauge0.withdraw(rest0, { from: user });
        await this.minter.mint(this.gauge0.address, { from: user });
        await this.token0.approve(this.gauge0.address, ether('0'), {
          from: user,
        });
      });

      it('normal', async function() {
        await this.minter.toggle_approve_mint(this.proxy.address, {
          from: user,
        });
        const to = this.hCurveDao.address;
        const data = abi.simpleEncode('mint(address)', this.gauge0.address);
        const claimableToken = await this.gauge0.claimable_tokens.call(user);
        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: ether('0.1'),
        });

        // Get handler return result
        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );
        const crvUserEnd = await this.crv.balanceOf.call(user);
        expect(handlerReturn).to.be.bignumber.eq(crvUserEnd.sub(crvUser));

        expect(crvUserEnd.sub(crvUser)).to.be.bignumber.gte(claimableToken);
        expect(
          await this.token0.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.eq(ether('0'));
        expect(
          await this.crv.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.eq(ether('0'));
        profileGas(receipt);
      });

      it('without approval', async function() {
        const to = this.hCurveDao.address;
        const data = abi.simpleEncode('mint(address)', this.gauge0.address);
        await expectRevert(
          this.proxy.execMock(to, data, {
            from: user,
            value: ether('0.1'),
          }),
          'HCurveDao_mint: not allowed to mint'
        );
      });
    });

    describe('from multiple gauges', function() {
      beforeEach(async function() {
        await this.token0.transfer(user, gauge0Amount, {
          from: token0Provider,
        });
        await this.token1.transfer(user, gauge1Amount, {
          from: token1Provider,
        });
        await this.token0.approve(this.gauge0.address, gauge0Amount, {
          from: user,
        });
        await this.token1.approve(this.gauge1.address, gauge1Amount, {
          from: user,
        });
        await this.gauge0.deposit(gauge0Amount, user, { from: user });
        await this.gauge1.deposit(gauge1Amount, user, { from: user });
        await increase(duration.days('30'));
        crvUser = await this.crv.balanceOf.call(user);
      });

      afterEach(async function() {
        const rest0 = await this.gauge0.balanceOf.call(user);
        const rest1 = await this.gauge0.balanceOf.call(user);
        await this.gauge0.withdraw(rest0, { from: user });
        await this.gauge1.withdraw(rest1, { from: user });
        await this.minter.mint(this.gauge0.address, { from: user });
        await this.minter.mint(this.gauge1.address, { from: user });
        await this.token0.approve(this.gauge0.address, ether('0'), {
          from: user,
        });
        await this.token1.approve(this.gauge1.address, ether('0'), {
          from: user,
        });
      });

      it('normal', async function() {
        await this.minter.toggle_approve_mint(this.proxy.address, {
          from: user,
        });
        const to = this.hCurveDao.address;
        const data = abi.simpleEncode('mintMany(address[])', [
          this.gauge0.address,
          this.gauge1.address,
        ]);
        const claimableToken0 = await this.gauge0.claimable_tokens.call(user);
        const claimableToken1 = await this.gauge1.claimable_tokens.call(user);
        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: ether('0.1'),
        });

        // Get handler return result
        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );
        const crvUserEnd = await this.crv.balanceOf.call(user);
        expect(handlerReturn).to.be.bignumber.eq(crvUserEnd.sub(crvUser));

        expect(crvUserEnd.sub(crvUser)).to.be.bignumber.gte(
          claimableToken0.add(claimableToken1)
        );
        expect(
          await this.token0.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.eq(ether('0'));
        expect(
          await this.token1.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.eq(ether('0'));
        expect(
          await this.crv.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.eq(ether('0'));
        profileGas(receipt);
      });

      it('without approval', async function() {
        const to = this.hCurveDao.address;
        const data = abi.simpleEncode('mintMany(address[])', [
          this.gauge0.address,
          this.gauge1.address,
        ]);
        await expectRevert(
          this.proxy.execMock(to, data, {
            from: user,
            value: ether('0.1'),
          }),
          'HCurveDao_mintMany: not allowed to mint'
        );
      });
    });
  });
});
