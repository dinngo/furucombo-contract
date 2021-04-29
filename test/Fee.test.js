const {
  balance,
  BN,
  constants,
  ether,
  expectEvent,
  expectRevert,
} = require('@openzeppelin/test-helpers');
const { tracker } = balance;
const { ZERO_BYTES32, MAX_UINT256 } = constants;
const abi = require('ethereumjs-abi');
const utils = web3.utils;

const { expect } = require('chai');

const {
  COMBO_TOKEN,
  COMBO_PROVIDER,
  DAI_TOKEN,
  DAI_PROVIDER,
} = require('./utils/constants');
const { evmRevert, evmSnapshot, profileGas } = require('./utils/utils');

const Proxy = artifacts.require('Proxy');
const Registry = artifacts.require('Registry');
const FeeRuleRegistry = artifacts.require('FeeRuleRegistry');
const RuleMock1 = artifacts.require('RuleMock1');
const RuleMock2 = artifacts.require('RuleMock2');
const HFunds = artifacts.require('HFunds');
const IToken = artifacts.require('IERC20');

const BASE = ether('1');
const BASIS_FEE_RATE = ether('0.01'); // 1%
const RULE1_DISCOUNT = ether('0.9'); // should match DISCOUNT of RuleMock1
const RULE2_DISCOUNT = ether('0.8'); // should match DISCOUNT of RuleMock2
const RULE1_REQUIREMENT = ether('50'); // should match the verify requirement in RuleMock1
const RULE2_REQUIREMENT = ether('10'); // should match the verify requirement in RuleMock2

contract('Fee', function([_, feeCollector, user]) {
  const tokenAddress = DAI_TOKEN;
  const providerAddress = DAI_PROVIDER;
  const rule1TokenAddress = COMBO_TOKEN;
  const rule1TokenProviderAddress = COMBO_PROVIDER;
  const ethAmount = ether('10');
  const tokenAmount = ether('100');

  let id;
  let balanceUser;
  let balanceProxy;
  let balanceFeeCollector;
  let tokenUser;
  let tokenProxy;
  let tokenFeeCollector;

  before(async function() {
    // Handlers related
    this.registry = await Registry.new();
    this.hFunds = await HFunds.new();
    await this.registry.register(
      this.hFunds.address,
      utils.asciiToHex('Funds')
    );
    // Fee related
    this.feeRuleRegistry = await FeeRuleRegistry.new(
      BASIS_FEE_RATE,
      feeCollector
    );
    this.rule1 = await RuleMock1.new();
    this.rule2 = await RuleMock2.new();
    await this.feeRuleRegistry.registerRule('0', this.rule1.address);
    await this.feeRuleRegistry.registerRule('1', this.rule2.address);
    // Deploy proxy
    this.proxy = await Proxy.new(
      this.registry.address,
      this.feeRuleRegistry.address
    );
    // Prepare
    this.token = await IToken.at(tokenAddress);
    await this.token.transfer(user, tokenAmount, { from: providerAddress });
    await this.token.approve(this.proxy.address, tokenAmount, { from: user });
    this.rule1Token = await IToken.at(rule1TokenAddress);
    await this.rule1Token.transfer(user, RULE1_REQUIREMENT, {
      from: rule1TokenProviderAddress,
    });
  });

  beforeEach(async function() {
    id = await evmSnapshot();
    balanceUser = await tracker(user);
    balanceProxy = await tracker(this.proxy.address);
    balanceFeeCollector = await tracker(feeCollector);
    tokenUser = await this.token.balanceOf.call(user);
    tokenProxy = await this.token.balanceOf.call(this.proxy.address);
    tokenFeeCollector = await this.token.balanceOf.call(feeCollector);
  });

  afterEach(async function() {
    await evmRevert(id);
  });

  describe('inject', function() {
    before(async function() {
    });

    it('eth + token', async function() {
      const tos = [this.hFunds.address];
      const configs = [ZERO_BYTES32];
      const ruleIndexes = ['0', '1'];
      const datas = [
        abi.simpleEncode(
          'inject(address[],uint256[])',
          [tokenAddress],
          [tokenAmount]
        ),
      ];

      const receipt = await this.proxy.batchExec(tos, configs, datas, ruleIndexes, {
        from: user,
        value: ethAmount,
      });

      const feeRateUser = BASIS_FEE_RATE.mul(RULE1_DISCOUNT).mul(RULE2_DISCOUNT).div(BASE).div(BASE);
      const feeETH = ethAmount.mul(feeRateUser).div(BASE);
      const feeToken = tokenAmount.mul(feeRateUser).div(BASE);

      console.log(`feeRateUser = ${utils.fromWei(feeRateUser)}`);
      console.log(`feeETH = ${utils.fromWei(feeETH)}`);
      console.log(`feeToken = ${utils.fromWei(feeToken)}`);
      console.log(`gasUsed = ${receipt.receipt.gasUsed.toString()}`);

      // Fee collector
      expect(await balanceFeeCollector.delta()).to.be.bignumber.eq(feeETH);
      expect(await this.token.balanceOf.call(feeCollector)).to.be.bignumber.eq(feeToken);
      // Proxy
      expect(await balanceProxy.delta()).to.be.zero;
      expect(await this.token.balanceOf.call(this.proxy.address)).to.be.zero;
      // User
      expect(await balanceUser.delta()).to.be.bignumber.eq(ether('0').sub(feeETH).sub(new BN(receipt.receipt.gasUsed)));
      expect(await this.token.balanceOf.call(user)).to.be.bignumber.eq(tokenAmount.sub(feeToken));
    });

    it('zero fee', async function() {
      // Set basis fee rate to 0
      await this.feeRuleRegistry.setBasisFeeRate(ether('0'));
      expect(await this.feeRuleRegistry.basisFeeRate.call()).to.be.zero;
      
      const tos = [this.hFunds.address];
      const configs = [ZERO_BYTES32];
      const ruleIndexes = ['0', '1'];
      const datas = [
        abi.simpleEncode(
          'inject(address[],uint256[])',
          [tokenAddress],
          [tokenAmount]
        ),
      ];

      const receipt = await this.proxy.batchExec(tos, configs, datas, ruleIndexes, {
        from: user,
        value: ethAmount,
      });

      console.log(`gasUsed = ${receipt.receipt.gasUsed.toString()}`);

      // Fee collector
      expect(await balanceFeeCollector.delta()).to.be.zero;
      expect(await this.token.balanceOf.call(feeCollector)).to.be.zero;
      // Proxy
      expect(await balanceProxy.delta()).to.be.zero;
      expect(await this.token.balanceOf.call(this.proxy.address)).to.be.zero;
      // User
      expect(await balanceUser.delta()).to.be.bignumber.eq(ether('0').sub(new BN(receipt.receipt.gasUsed)));
      expect(await this.token.balanceOf.call(user)).to.be.bignumber.eq(tokenAmount);
    });
  });
});
