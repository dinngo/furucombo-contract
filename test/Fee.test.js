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
  USDT_TOKEN,
  USDT_PROVIDER,
  HBTC_TOKEN,
  HBTC_PROVIDER,
  OMG_TOKEN,
  OMG_PROVIDER,
  KNC_TOKEN,
  KNC_PROVIDER,
} = require('./utils/constants');
const {
  evmRevert,
  evmSnapshot,
  profileGas,
  checkCacheClean,
} = require('./utils/utils');

const Proxy = artifacts.require('Proxy');
const Registry = artifacts.require('Registry');
const FeeRuleRegistry = artifacts.require('FeeRuleRegistry');
const RuleMock1 = artifacts.require('RuleMock1');
const RuleMock2 = artifacts.require('RuleMock2');
const HFunds = artifacts.require('HFunds');
const IToken = artifacts.require('IERC20');
const IUsdt = artifacts.require('IERC20Usdt');

const BASE = ether('1');
const BASIS_FEE_RATE = ether('0.01'); // 1%
const RULE1_DISCOUNT = ether('0.9'); // should match DISCOUNT of RuleMock1
const RULE2_DISCOUNT = ether('0.8'); // should match DISCOUNT of RuleMock2
const RULE1_REQUIREMENT = ether('50'); // should match the verify requirement in RuleMock1
const RULE2_REQUIREMENT = ether('10'); // should match the verify requirement in RuleMock2

contract('Fee', function([_, feeCollector, user]) {
  const tokenAddress = DAI_TOKEN;
  const providerAddress = DAI_PROVIDER;
  const token2Address = KNC_TOKEN;
  const provider2Address = KNC_PROVIDER;
  const rule1TokenAddress = COMBO_TOKEN;
  const rule1TokenProviderAddress = COMBO_PROVIDER;
  const ethAmount = ether('10');
  const tokenAmount = ether('100');
  const token2Amount = ether('100');
  const usdtAmount = new BN('100000000'); // 100 usdt
  const hbtcAmount = ether('1');
  const omgAmount = ether('10');

  let id;
  let balanceUser;
  let balanceProxy;
  let balanceFeeCollector;

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
    await this.feeRuleRegistry.registerRule(this.rule1.address);
    await this.feeRuleRegistry.registerRule(this.rule2.address);
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
    // Prepare token
    this.token2 = await IToken.at(token2Address);
    await this.token2.transfer(user, token2Amount, { from: provider2Address });
    await this.token2.approve(this.proxy.address, token2Amount, { from: user });
    this.usdt = await IUsdt.at(USDT_TOKEN);
    await this.usdt.transfer(user, usdtAmount, { from: USDT_PROVIDER });
    await this.usdt.approve(this.proxy.address, usdtAmount, { from: user });
    this.hbtc = await IToken.at(HBTC_TOKEN);
    await this.hbtc.transfer(user, hbtcAmount, { from: HBTC_PROVIDER });
    await this.hbtc.approve(this.proxy.address, hbtcAmount, { from: user });
    this.omg = await IToken.at(OMG_TOKEN);
    await this.omg.transfer(user, omgAmount, { from: OMG_PROVIDER });
    await this.omg.approve(this.proxy.address, omgAmount, { from: user });
  });

  beforeEach(async function() {
    id = await evmSnapshot();
    balanceUser = await tracker(user);
    balanceProxy = await tracker(this.proxy.address);
    balanceFeeCollector = await tracker(feeCollector);
  });

  afterEach(async function() {
    await checkCacheClean(this.proxy.address);
    await evmRevert(id);
  });

  describe('single token', function() {
    it('eth', async function() {
      const tos = [this.hFunds.address];
      const configs = [ZERO_BYTES32];
      const ruleIndexes = ['0', '1'];
      const datas = [
        abi.simpleEncode('send(uint256,address)', ether('0'), user),
      ];
      const receipt = await this.proxy.batchExec(
        tos,
        configs,
        datas,
        ruleIndexes,
        {
          from: user,
          value: ethAmount,
        }
      );
      const feeRateUser = BASIS_FEE_RATE.mul(RULE1_DISCOUNT)
        .mul(RULE2_DISCOUNT)
        .div(BASE)
        .div(BASE);
      const feeETH = ethAmount.mul(feeRateUser).div(BASE);
      // Fee collector
      expect(await balanceFeeCollector.delta()).to.be.bignumber.eq(feeETH);
      // Proxy
      expect(await balanceProxy.delta()).to.be.zero;
      // User
      expect(await balanceUser.delta()).to.be.bignumber.eq(
        ether('0')
          .sub(feeETH)
          .sub(new BN(receipt.receipt.gasUsed))
      );
    });

    it('DAI', async function() {
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
      const receipt = await this.proxy.batchExec(
        tos,
        configs,
        datas,
        ruleIndexes,
        {
          from: user,
        }
      );
      const feeRateUser = BASIS_FEE_RATE.mul(RULE1_DISCOUNT)
        .mul(RULE2_DISCOUNT)
        .div(BASE)
        .div(BASE);
      const feeToken = tokenAmount.mul(feeRateUser).div(BASE);
      // Fee collector
      expect(await balanceFeeCollector.delta()).to.be.zero;
      expect(await this.token.balanceOf.call(feeCollector)).to.be.bignumber.eq(
        feeToken
      );
      // Proxy
      expect(await balanceProxy.delta()).to.be.zero;
      expect(await this.token.balanceOf.call(this.proxy.address)).to.be.zero;
      // User
      expect(await balanceUser.delta()).to.be.bignumber.eq(
        ether('0').sub(new BN(receipt.receipt.gasUsed))
      );
      expect(await this.token.balanceOf.call(user)).to.be.bignumber.eq(
        tokenAmount.sub(feeToken)
      );
    });

    it('USDT', async function() {
      const tos = [this.hFunds.address];
      const configs = [ZERO_BYTES32];
      const ruleIndexes = ['0', '1'];
      const datas = [
        abi.simpleEncode(
          'inject(address[],uint256[])',
          [USDT_TOKEN],
          [usdtAmount]
        ),
      ];
      const receipt = await this.proxy.batchExec(
        tos,
        configs,
        datas,
        ruleIndexes,
        {
          from: user,
        }
      );
      const feeRateUser = BASIS_FEE_RATE.mul(RULE1_DISCOUNT)
        .mul(RULE2_DISCOUNT)
        .div(BASE)
        .div(BASE);
      const feeToken = usdtAmount.mul(feeRateUser).div(BASE);
      // Fee collector
      expect(await balanceFeeCollector.delta()).to.be.zero;
      expect(await this.usdt.balanceOf.call(feeCollector)).to.be.bignumber.eq(
        feeToken
      );
      // Proxy
      expect(await balanceProxy.delta()).to.be.zero;
      expect(await this.usdt.balanceOf.call(this.proxy.address)).to.be.zero;
      // User
      expect(await balanceUser.delta()).to.be.bignumber.eq(
        ether('0').sub(new BN(receipt.receipt.gasUsed))
      );
      expect(await this.usdt.balanceOf.call(user)).to.be.bignumber.eq(
        usdtAmount.sub(feeToken)
      );
    });

    it('HBTC', async function() {
      const tos = [this.hFunds.address];
      const configs = [ZERO_BYTES32];
      const ruleIndexes = ['0', '1'];
      const datas = [
        abi.simpleEncode(
          'inject(address[],uint256[])',
          [HBTC_TOKEN],
          [hbtcAmount]
        ),
      ];
      const receipt = await this.proxy.batchExec(
        tos,
        configs,
        datas,
        ruleIndexes,
        {
          from: user,
        }
      );
      const feeRateUser = BASIS_FEE_RATE.mul(RULE1_DISCOUNT)
        .mul(RULE2_DISCOUNT)
        .div(BASE)
        .div(BASE);
      const feeToken = hbtcAmount.mul(feeRateUser).div(BASE);
      // Fee collector
      expect(await balanceFeeCollector.delta()).to.be.zero;
      expect(await this.hbtc.balanceOf.call(feeCollector)).to.be.bignumber.eq(
        feeToken
      );
      // Proxy
      expect(await balanceProxy.delta()).to.be.zero;
      expect(await this.hbtc.balanceOf.call(this.proxy.address)).to.be.zero;
      // User
      expect(await balanceUser.delta()).to.be.bignumber.eq(
        ether('0').sub(new BN(receipt.receipt.gasUsed))
      );
      expect(await this.hbtc.balanceOf.call(user)).to.be.bignumber.eq(
        hbtcAmount.sub(feeToken)
      );
    });

    it('OMG', async function() {
      const tos = [this.hFunds.address];
      const configs = [ZERO_BYTES32];
      const ruleIndexes = ['0', '1'];
      const datas = [
        abi.simpleEncode(
          'inject(address[],uint256[])',
          [OMG_TOKEN],
          [omgAmount]
        ),
      ];
      const receipt = await this.proxy.batchExec(
        tos,
        configs,
        datas,
        ruleIndexes,
        {
          from: user,
        }
      );
      const feeRateUser = BASIS_FEE_RATE.mul(RULE1_DISCOUNT)
        .mul(RULE2_DISCOUNT)
        .div(BASE)
        .div(BASE);
      const feeToken = omgAmount.mul(feeRateUser).div(BASE);
      // Fee collector
      expect(await balanceFeeCollector.delta()).to.be.zero;
      expect(await this.omg.balanceOf.call(feeCollector)).to.be.bignumber.eq(
        feeToken
      );
      // Proxy
      expect(await balanceProxy.delta()).to.be.zero;
      expect(await this.omg.balanceOf.call(this.proxy.address)).to.be.zero;
      // User
      expect(await balanceUser.delta()).to.be.bignumber.eq(
        ether('0').sub(new BN(receipt.receipt.gasUsed))
      );
      expect(await this.omg.balanceOf.call(user)).to.be.bignumber.eq(
        omgAmount.sub(feeToken)
      );
    });
  });

  describe('multiple token', function() {
    it('eth + token -> no index', async function() {
      const tos = [this.hFunds.address];
      const configs = [ZERO_BYTES32];
      const ruleIndexes = [];
      const datas = [
        abi.simpleEncode(
          'inject(address[],uint256[])',
          [tokenAddress],
          [tokenAmount]
        ),
      ];
      const receipt = await this.proxy.batchExec(
        tos,
        configs,
        datas,
        ruleIndexes,
        {
          from: user,
          value: ethAmount,
        }
      );
      const feeRateUser = BASIS_FEE_RATE;
      const feeETH = ethAmount.mul(feeRateUser).div(BASE);
      const feeToken = tokenAmount.mul(feeRateUser).div(BASE);
      // Fee collector
      expect(await balanceFeeCollector.delta()).to.be.bignumber.eq(feeETH);
      expect(await this.token.balanceOf.call(feeCollector)).to.be.bignumber.eq(
        feeToken
      );
      // Proxy
      expect(await balanceProxy.delta()).to.be.zero;
      expect(await this.token.balanceOf.call(this.proxy.address)).to.be.zero;
      // User
      expect(await balanceUser.delta()).to.be.bignumber.eq(
        ether('0')
          .sub(feeETH)
          .sub(new BN(receipt.receipt.gasUsed))
      );
      expect(await this.token.balanceOf.call(user)).to.be.bignumber.eq(
        tokenAmount.sub(feeToken)
      );
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
      const receipt = await this.proxy.batchExec(
        tos,
        configs,
        datas,
        ruleIndexes,
        {
          from: user,
          value: ethAmount,
        }
      );
      const feeRateUser = BASIS_FEE_RATE.mul(RULE1_DISCOUNT)
        .mul(RULE2_DISCOUNT)
        .div(BASE)
        .div(BASE);
      const feeETH = ethAmount.mul(feeRateUser).div(BASE);
      const feeToken = tokenAmount.mul(feeRateUser).div(BASE);
      // Fee collector
      expect(await balanceFeeCollector.delta()).to.be.bignumber.eq(feeETH);
      expect(await this.token.balanceOf.call(feeCollector)).to.be.bignumber.eq(
        feeToken
      );
      // Proxy
      expect(await balanceProxy.delta()).to.be.zero;
      expect(await this.token.balanceOf.call(this.proxy.address)).to.be.zero;
      // User
      expect(await balanceUser.delta()).to.be.bignumber.eq(
        ether('0')
          .sub(feeETH)
          .sub(new BN(receipt.receipt.gasUsed))
      );
      expect(await this.token.balanceOf.call(user)).to.be.bignumber.eq(
        tokenAmount.sub(feeToken)
      );
    });

    it('token + token', async function() {
      const tos = [this.hFunds.address];
      const configs = [ZERO_BYTES32];
      const ruleIndexes = ['0', '1'];
      const datas = [
        abi.simpleEncode(
          'inject(address[],uint256[])',
          [tokenAddress, token2Address],
          [tokenAmount, token2Amount]
        ),
      ];
      const receipt = await this.proxy.batchExec(
        tos,
        configs,
        datas,
        ruleIndexes,
        {
          from: user,
        }
      );
      const feeRateUser = BASIS_FEE_RATE.mul(RULE1_DISCOUNT)
        .mul(RULE2_DISCOUNT)
        .div(BASE)
        .div(BASE);
      const feeToken = tokenAmount.mul(feeRateUser).div(BASE);
      const feeToken2 = token2Amount.mul(feeRateUser).div(BASE);
      // Fee collector
      expect(await this.token.balanceOf.call(feeCollector)).to.be.bignumber.eq(
        feeToken
      );
      expect(await this.token2.balanceOf.call(feeCollector)).to.be.bignumber.eq(
        feeToken2
      );
      // Proxy
      expect(await this.token.balanceOf.call(this.proxy.address)).to.be.zero;
      expect(await this.token2.balanceOf.call(this.proxy.address)).to.be.zero;
      // User
      expect(await balanceUser.delta()).to.be.bignumber.eq(
        ether('0').sub(new BN(receipt.receipt.gasUsed))
      );
      expect(await this.token.balanceOf.call(user)).to.be.bignumber.eq(
        tokenAmount.sub(feeToken)
      );
      expect(await this.token2.balanceOf.call(user)).to.be.bignumber.eq(
        token2Amount.sub(feeToken2)
      );
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
      const receipt = await this.proxy.batchExec(
        tos,
        configs,
        datas,
        ruleIndexes,
        {
          from: user,
          value: ethAmount,
        }
      );
      // Fee collector
      expect(await balanceFeeCollector.delta()).to.be.zero;
      expect(await this.token.balanceOf.call(feeCollector)).to.be.zero;
      // Proxy
      expect(await balanceProxy.delta()).to.be.zero;
      expect(await this.token.balanceOf.call(this.proxy.address)).to.be.zero;
      // User
      expect(await balanceUser.delta()).to.be.bignumber.eq(
        ether('0').sub(new BN(receipt.receipt.gasUsed))
      );
      expect(await this.token.balanceOf.call(user)).to.be.bignumber.eq(
        tokenAmount
      );
    });
  });
});
