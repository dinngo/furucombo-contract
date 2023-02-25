const {
  balance,
  BN,
  constants,
  ether,
  send,
  expectEvent,
  expectRevert,
} = require('@openzeppelin/test-helpers');
const { tracker } = balance;
const { ZERO_ADDRESS } = constants;

const { expect } = require('chai');

const { LINK_TOKEN, WETH_TOKEN } = require('./utils/constants');
const { evmRevert, evmSnapshot, getTokenProvider } = require('./utils/utils');

const FeeRuleRegistry = artifacts.require('FeeRuleRegistry');
const RuleMock1 = artifacts.require('RuleMock1');
const RuleMock2 = artifacts.require('RuleMock2');
const IToken = artifacts.require('IERC20');

const BASE = ether('1');
const BASIS_FEE_RATE = ether('0.01'); // 1%
const RULE1_DISCOUNT = ether('0.9'); // should match DISCOUNT of RuleMock1
const RULE2_DISCOUNT = ether('0.8'); // should match DISCOUNT of RuleMock2
const RULE1_REQUIREMENT = ether('50'); // should match the verify requirement in RuleMock1

contract('FeeRuleRegistry', function ([_, feeCollector, user, someone]) {
  const tokenAddress = LINK_TOKEN; // should match the verify requirement token in RuleMock1

  let id;

  before(async function () {
    this.registry = await FeeRuleRegistry.new(BASIS_FEE_RATE, feeCollector);
    this.rule1 = await RuleMock1.new(tokenAddress);
    this.rule2 = await RuleMock2.new();
    this.token = await IToken.at(tokenAddress);
    this.providerAddress = await getTokenProvider(
      tokenAddress,
      WETH_TOKEN,
      3000
    );
  });

  beforeEach(async function () {
    id = await evmSnapshot();
  });

  afterEach(async function () {
    await evmRevert(id);
  });

  describe('set basis fee rate', function () {
    it('normal', async function () {
      const newFeeRate = ether('0.05');
      const receipt = await this.registry.setBasisFeeRate(newFeeRate);
      expect(await this.registry.basisFeeRate.call()).to.be.bignumber.eq(
        newFeeRate
      );
      expectEvent(receipt, 'SetBasisFeeRate', {
        basisFeeRate: newFeeRate,
      });
    });

    it('should revert: out of range', async function () {
      await expectRevert(
        this.registry.setBasisFeeRate(ether('2')),
        'Out of range'
      );
    });

    it('should revert: same as current one', async function () {
      await expectRevert(
        this.registry.setBasisFeeRate(BASIS_FEE_RATE),
        'Same as current one'
      );
    });

    it('should revert: not owner', async function () {
      const newFeeRate = ether('0.05');
      await expectRevert(
        this.registry.setBasisFeeRate(newFeeRate, { from: someone }),
        'Ownable: caller is not the owner'
      );
    });
  });

  describe('set fee collector', function () {
    it('normal', async function () {
      const receipt = await this.registry.setFeeCollector(someone);
      expect(await this.registry.feeCollector.call()).to.be.eq(someone);
      expectEvent(receipt, 'SetFeeCollector', {
        feeCollector: someone,
      });
    });

    it('should revert: zero address', async function () {
      await expectRevert(
        this.registry.setFeeCollector(ZERO_ADDRESS),
        'Zero address'
      );
    });

    it('should revert: same as current one', async function () {
      await expectRevert(
        this.registry.setFeeCollector(feeCollector),
        'Same as current one'
      );
    });

    it('should revert: not owner', async function () {
      await expectRevert(
        this.registry.setFeeCollector(someone, { from: someone }),
        'Ownable: caller is not the owner'
      );
    });
  });

  describe('register', function () {
    it('normal', async function () {
      // register first rule
      const receipt1 = await this.registry.registerRule(this.rule1.address);
      expect(await this.registry.rules.call('0')).to.be.eq(this.rule1.address);
      expect(await this.registry.counter.call()).to.be.bignumber.eq(
        new BN('1')
      );
      expectEvent(receipt1, 'RegisteredRule', {
        index: '0',
        rule: this.rule1.address,
      });
      // register second rule
      const receipt2 = await this.registry.registerRule(this.rule2.address);
      expect(await this.registry.rules.call('1')).to.be.eq(this.rule2.address);
      expect(await this.registry.counter.call()).to.be.bignumber.eq(
        new BN('2')
      );
      expectEvent(receipt2, 'RegisteredRule', {
        index: '1',
        rule: this.rule2.address,
      });
    });

    it('should revert: rule is zero address', async function () {
      await expectRevert(
        this.registry.registerRule(ZERO_ADDRESS),
        'Not allow to register zero address'
      );
    });

    it('should revert: not owner', async function () {
      await expectRevert(
        this.registry.registerRule(this.rule1.address, { from: someone }),
        'Ownable: caller is not the owner'
      );
    });
  });

  describe('unregister', function () {
    beforeEach(async function () {
      // register first rule
      const receipt1 = await this.registry.registerRule(this.rule1.address);
      expect(await this.registry.rules.call('0')).to.be.eq(this.rule1.address);
      // register second rule
      const receipt2 = await this.registry.registerRule(this.rule2.address);
      expect(await this.registry.rules.call('1')).to.be.eq(this.rule2.address);
    });

    it('normal', async function () {
      // unregister first rule
      const receipt = await this.registry.unregisterRule('0');
      expect(await this.registry.rules.call('0')).to.be.eq(ZERO_ADDRESS);
      // counter should remain unchanged after two rules registered
      expect(await this.registry.counter.call()).to.be.bignumber.eq(
        new BN('2')
      );
      expectEvent(receipt, 'UnregisteredRule', {
        index: '0',
      });
      // rule2 registerd should remain unchanged
      expect(await this.registry.rules.call('1')).to.be.eq(this.rule2.address);
    });

    it('should revert: index not registered', async function () {
      await expectRevert(
        this.registry.unregisterRule('10'),
        'Rule not set or unregistered'
      );
    });

    it('should revert: already unregistered', async function () {
      await this.registry.unregisterRule('0');
      await expectRevert(
        this.registry.unregisterRule('0'),
        'Rule not set or unregistered'
      );
    });

    it('should revert: not owner', async function () {
      await expectRevert(
        this.registry.unregisterRule('0', { from: someone }),
        'Ownable: caller is not the owner'
      );
    });
  });

  describe('calculate single', function () {
    beforeEach(async function () {
      const receipt = await this.registry.registerRule(this.rule1.address);
      expect(await this.registry.rules.call('0')).to.be.eq(this.rule1.address);
      // transfer some token to user to make him qualified for rule1
      const tokenUserBalanceBefore = await this.token.balanceOf(user);
      await this.token.transfer(user, RULE1_REQUIREMENT, {
        from: this.providerAddress,
      });
      expect(await this.token.balanceOf(user)).to.be.bignumber.eq(
        tokenUserBalanceBefore.add(RULE1_REQUIREMENT)
      );
    });

    it('qualified without basis', async function () {
      const queryAddr = user;
      const rate = await this.registry.calFeeRateWithoutBasis.call(
        queryAddr,
        '0'
      );
      expect(rate).to.be.bignumber.eq(RULE1_DISCOUNT);
    });

    it('qualified with basis', async function () {
      const queryAddr = user;
      const rate = await this.registry.calFeeRate.call(queryAddr, '0');
      expect(rate).to.be.bignumber.eq(
        RULE1_DISCOUNT.mul(BASIS_FEE_RATE).div(BASE)
      );
    });

    it('not qualified without basis', async function () {
      const queryAddr = someone;
      const rate = await this.registry.calFeeRateWithoutBasis.call(
        queryAddr,
        '0'
      );
      expect(rate).to.be.bignumber.eq(BASE);
    });

    it('not qualified with basis', async function () {
      const queryAddr = someone;
      const rate = await this.registry.calFeeRate.call(queryAddr, '0');
      expect(rate).to.be.bignumber.eq(BASIS_FEE_RATE);
    });

    it('index not registered', async function () {
      const queryAddr = user;
      const rate = await this.registry.calFeeRateWithoutBasis.call(
        queryAddr,
        '50'
      );
      expect(rate).to.be.bignumber.eq(BASE);
    });

    it('index unregistered', async function () {
      // unregister rule first
      const receipt = await this.registry.unregisterRule('0');
      expect(await this.registry.rules.call('0')).to.be.eq(ZERO_ADDRESS);

      const queryAddr = user;
      const rate = await this.registry.calFeeRateWithoutBasis.call(
        queryAddr,
        '0'
      );
      expect(rate).to.be.bignumber.eq(BASE);
    });
  });

  describe('calculate multi', function () {
    beforeEach(async function () {
      // register first rule
      const receipt1 = await this.registry.registerRule(this.rule1.address);
      expect(await this.registry.rules.call('0')).to.be.eq(this.rule1.address);
      // register second rule
      const receipt2 = await this.registry.registerRule(this.rule2.address);
      expect(await this.registry.rules.call('1')).to.be.eq(this.rule2.address);
      // transfer some token to user to make him qualified for rule1
      const tokenUserBalanceBefore = await this.token.balanceOf(user);

      await this.token.transfer(user, RULE1_REQUIREMENT, {
        from: this.providerAddress,
      });
      expect(await this.token.balanceOf(user)).to.be.bignumber.eq(
        tokenUserBalanceBefore.add(RULE1_REQUIREMENT)
      );
    });

    it('multiple indexes: qualified for both without basis', async function () {
      const queryAddr = user;
      const indexes = ['0', '1'];
      const rate = await this.registry.calFeeRateMultiWithoutBasis.call(
        queryAddr,
        indexes
      );
      expect(rate).to.be.bignumber.eq(
        RULE1_DISCOUNT.mul(RULE2_DISCOUNT).div(BASE)
      );
    });

    it('multiple indexes: qualified for both with basis', async function () {
      const queryAddr = user;
      const indexes = ['0', '1'];
      const rate = await this.registry.calFeeRateMulti.call(queryAddr, indexes);
      expect(rate).to.be.bignumber.eq(
        RULE1_DISCOUNT.mul(RULE2_DISCOUNT)
          .mul(BASIS_FEE_RATE)
          .div(BASE)
          .div(BASE)
      );
    });

    it('multiple indexes: qualified for single without basis', async function () {
      const queryAddr = someone;
      const indexes = ['0', '1'];
      const rate = await this.registry.calFeeRateMultiWithoutBasis.call(
        queryAddr,
        indexes
      );
      expect(rate).to.be.bignumber.eq(RULE2_DISCOUNT);
    });

    it('multiple indexes: qualified for single with basis', async function () {
      const queryAddr = someone;
      const indexes = ['0', '1'];
      const rate = await this.registry.calFeeRateMulti.call(queryAddr, indexes);
      expect(rate).to.be.bignumber.eq(
        RULE2_DISCOUNT.mul(BASIS_FEE_RATE).div(BASE)
      );
    });

    it('multiple indexes: not qualified without basis', async function () {
      // empty 'someone' to make him not qualified for rule2
      await send.ether(
        someone,
        ZERO_ADDRESS,
        (await balance.current(someone)).sub(ether('0.1'))
      );

      const queryAddr = someone;
      const indexes = ['0', '1'];
      const rate = await this.registry.calFeeRateMultiWithoutBasis.call(
        queryAddr,
        indexes
      );
      expect(rate).to.be.bignumber.eq(BASE);
    });

    it('multiple indexes: not qualified with basis', async function () {
      // empty 'someone' to make him not qualified for rule2
      await send.ether(
        someone,
        ZERO_ADDRESS,
        (await balance.current(someone)).sub(ether('0.1'))
      );
      balanceUser = await tracker(someone);

      const queryAddr = someone;
      const indexes = ['0', '1'];
      const rate = await this.registry.calFeeRateMulti.call(queryAddr, indexes);
      expect(rate).to.be.bignumber.eq(BASIS_FEE_RATE);
    });

    it('single index: qualified without basis', async function () {
      const queryAddr = user;
      const indexes = ['0'];
      const rate = await this.registry.calFeeRateMultiWithoutBasis.call(
        queryAddr,
        indexes
      );
      expect(rate).to.be.bignumber.eq(RULE1_DISCOUNT);
    });

    it('single index: qualified with basis', async function () {
      const queryAddr = user;
      const indexes = ['0'];
      const rate = await this.registry.calFeeRateMulti.call(queryAddr, indexes);
      expect(rate).to.be.bignumber.eq(
        RULE1_DISCOUNT.mul(BASIS_FEE_RATE).div(BASE)
      );
    });

    it('single index: not qualified without basis', async function () {
      const queryAddr = someone;
      const indexes = ['0'];
      const rate = await this.registry.calFeeRateMultiWithoutBasis.call(
        queryAddr,
        indexes
      );
      expect(rate).to.be.bignumber.eq(BASE);
    });

    it('single index: not qualified with basis', async function () {
      const queryAddr = someone;
      const indexes = ['0'];
      const rate = await this.registry.calFeeRateMulti.call(queryAddr, indexes);
      expect(rate).to.be.bignumber.eq(BASIS_FEE_RATE);
    });

    it('no index specified', async function () {
      const queryAddr = user;
      const indexes = [];
      const rate = await this.registry.calFeeRateMultiWithoutBasis.call(
        queryAddr,
        indexes
      );
      expect(rate).to.be.bignumber.eq(BASE);
    });

    it('should revert: duplicate index', async function () {
      const queryAddr = user;
      const indexes = ['0', '0'];
      await expectRevert(
        this.registry.calFeeRateMultiWithoutBasis.call(queryAddr, indexes),
        'Not ascending order'
      );
    });

    it('should revert: not ascending order', async function () {
      const queryAddr = user;
      const indexes = ['1', '0'];
      await expectRevert(
        this.registry.calFeeRateMultiWithoutBasis.call(queryAddr, indexes),
        'Not ascending order'
      );
    });
  });
});
