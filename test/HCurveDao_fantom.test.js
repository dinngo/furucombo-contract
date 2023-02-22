if (network.config.chainId == 250) {
  // This test supports to run on these chains.
} else {
  return;
}

const {
  ether,
  expectRevert,
  constants,
} = require('@openzeppelin/test-helpers');
const { MAX_UINT256 } = constants;
const { expect } = require('chai');
const abi = require('ethereumjs-abi');
const utils = web3.utils;
const { CURVE_2POOLCRV, CURVE_2POOL_GAUGE } = require('./utils/constants');
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
const FeeRuleRegistry = artifacts.require('FeeRuleRegistry');
const HCurveDao = artifacts.require('HCurveDao');
const ILiquidityGauge = artifacts.require('ILiquidityGauge');
const IToken = artifacts.require('IERC20');

contract('Curve DAO', function([_, user]) {
  let id;
  // Wait for the gaude to be ready
  const token0Address = CURVE_2POOLCRV;
  const gauge0Address = CURVE_2POOL_GAUGE;
  const gauge0Amount = ether('0.1');
  const setApproveDepositSig = web3.eth.abi.encodeFunctionSignature(
    'set_approve_deposit(address,bool)'
  );

  let token0Provider;

  before(async function() {
    token0Provider = await tokenProviderCurveGauge(token0Address);

    this.registry = await Registry.new();
    this.hCurveDao = await HCurveDao.new();
    await this.registry.register(
      this.hCurveDao.address,
      utils.asciiToHex('HCurveDao')
    );
    this.token0 = await IToken.at(token0Address);
    this.gauge0 = await ILiquidityGauge.at(gauge0Address);
    this.feeRuleRegistry = await FeeRuleRegistry.new('0', _);
    this.proxy = await Proxy.new(
      this.registry.address,
      this.feeRuleRegistry.address
    );
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

      const depositUser = await this.gauge0.balanceOf(user);
      const receipt = await this.proxy.execMock(to, data, {
        from: user,
        value: ether('0.1'),
      });

      const depositUserEnd = await this.gauge0.balanceOf(user);
      expect(depositUserEnd.sub(depositUser)).to.be.bignumber.eq(gauge0Amount);
      expect(
        await this.token0.balanceOf(this.proxy.address)
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

      const depositUser = await this.gauge0.balanceOf(user);
      const receipt = await this.proxy.execMock(to, data, {
        from: user,
        value: ether('0.1'),
      });

      const depositUserEnd = await this.gauge0.balanceOf(user);
      expect(depositUserEnd.sub(depositUser)).to.be.bignumber.eq(gauge0Amount);
      expect(
        await this.token0.balanceOf(this.proxy.address)
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
      await this.token0.transfer(user, gauge0Amount, {
        from: token0Provider,
      });
      await this.token0.approve(this.gauge0.address, gauge0Amount, {
        from: user,
      });
      await this.gauge0.deposit(gauge0Amount, user, {
        from: user,
      });
      await this.gauge0.transfer(this.proxy.address, gauge0Amount, {
        from: user,
      });
    });

    it('normal', async function() {
      const to = this.hCurveDao.address;
      const data = abi.simpleEncode(
        'withdraw(address,uint256)',
        this.gauge0.address,
        gauge0Amount
      );
      withdrawUser = await this.token0.balanceOf(user);
      receipt = await this.proxy.execMock(to, data, {
        from: user,
        value: ether('0.1'),
      });
    });

    it('max amount', async function() {
      const to = this.hCurveDao.address;
      const data = abi.simpleEncode(
        'withdraw(address,uint256)',
        this.gauge0.address,
        MAX_UINT256
      );
      withdrawUser = await this.token0.balanceOf(user);
      receipt = await this.proxy.execMock(to, data, {
        from: user,
        value: ether('0.1'),
      });
    });

    afterEach(async function() {
      const withdrawUserEnd = await this.token0.balanceOf(user);

      // Check handler return
      const handlerReturn = utils.toBN(
        getHandlerReturn(receipt, ['uint256'])[0]
      );
      expect(handlerReturn).to.be.bignumber.eq(gauge0Amount);

      // Check lp amount
      expect(withdrawUserEnd.sub(withdrawUser)).to.be.bignumber.eq(
        gauge0Amount
      );
      expect(
        await this.token0.balanceOf(this.proxy.address)
      ).to.be.bignumber.eq(ether('0'));

      // Check gauge token amount
      expect(await this.gauge0.balanceOf(user)).to.be.bignumber.eq(ether('0'));
      expect(
        await this.gauge0.balanceOf(this.proxy.address)
      ).to.be.bignumber.eq(ether('0'));

      profileGas(receipt);
    });
  });
});
