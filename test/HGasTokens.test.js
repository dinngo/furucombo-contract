const { balance, BN, constants, ether } = require('@openzeppelin/test-helpers');
const { ZERO_BYTES32 } = constants;
const { tracker } = balance;
const { expect } = require('chai');
const abi = require('ethereumjs-abi');
const utils = web3.utils;
const {
  DAI_TOKEN,
  CHI_TOKEN,
  CHI_PROVIDER,
  GST2_TOKEN,
  GST2_PROVIDER,
} = require('./utils/constants');
const { evmRevert, evmSnapshot, profileGas } = require('./utils/utils');

const FeeRuleRegistry = artifacts.require('FeeRuleRegistry');
const Registry = artifacts.require('Registry');
const Proxy = artifacts.require('ProxyMock');
const HGasTokens = artifacts.require('HGasTokens');
const IGasTokens = artifacts.require('IGasTokens');
const IToken = artifacts.require('IERC20');
const HKyberNetwork = artifacts.require('HKyberNetwork');

contract('GasTokens', function([_, user]) {
  let id;

  before(async function() {
    this.registry = await Registry.new();
    this.feeRuleRegistry = await FeeRuleRegistry.new('0', _);
    this.proxy = await Proxy.new(
      this.registry.address,
      this.feeRuleRegistry.address
    );
    this.hGasTokens = await HGasTokens.new();
    await this.registry.register(
      this.hGasTokens.address,
      utils.asciiToHex('HGasTokens')
    );
    this.hKyberNetwork = await HKyberNetwork.new();
    await this.registry.register(
      this.hKyberNetwork.address,
      utils.asciiToHex('HKyberswap')
    );
  });

  beforeEach(async function() {
    id = await evmSnapshot();
  });

  afterEach(async function() {
    await evmRevert(id);
  });

  describe('Free gas tokens', function() {
    it('CHI token', async function() {
      // Create a combo including gas token cube and 1 dummy kyber cube

      // Firstly get gas cost when consume 0 gas token
      const value = ether('1');
      const config = [ZERO_BYTES32, ZERO_BYTES32];
      const ruleIndex = [];
      const toBefore = [this.hGasTokens.address, this.hKyberNetwork.address];
      const dataBefore = [
        abi.simpleEncode('freeCHI(uint256)', 0),
        abi.simpleEncode(
          'swapEtherToToken(uint256,address,uint256):(uint256)',
          value,
          DAI_TOKEN,
          new BN('1')
        ),
      ];
      const balanceUserBefore = await tracker(user);
      const receiptBefore = await this.proxy.batchExec(
        toBefore,
        config,
        dataBefore,
        ruleIndex,
        {
          from: user,
          value: value,
        }
      );
      const gasUsedBefore = new BN(receiptBefore.receipt.gasUsed);
      expect(await balanceUserBefore.delta()).to.be.bignumber.eq(
        ether('0')
          .sub(value)
          .sub(gasUsedBefore)
      );

      // Secondly get gas cost when consume 20 gas tokens
      const token = await IToken.at(CHI_TOKEN);
      const holdings = new BN('1000');
      await token.transfer(user, holdings, {
        from: CHI_PROVIDER,
      });
      await token.approve(this.proxy.address, holdings, { from: user });
      const to = [this.hGasTokens.address, this.hKyberNetwork.address];
      const amount = new BN('20');
      const data = [
        abi.simpleEncode('freeCHI(uint256)', amount),
        abi.simpleEncode(
          'swapEtherToToken(uint256,address,uint256):(uint256)',
          value,
          DAI_TOKEN,
          new BN('1')
        ),
      ];
      const balanceUser = await tracker(user);
      const tokenBalanceBefore = await token.balanceOf.call(user);
      const receipt = await this.proxy.batchExec(to, config, data, ruleIndex, {
        from: user,
        value: value,
      });
      const gasUsed = new BN(receipt.receipt.gasUsed);

      // Check proxy token balance
      expect(await token.balanceOf.call(this.proxy.address)).to.be.zero;

      // Check user eth balance
      expect(await balanceUser.delta()).to.be.bignumber.eq(
        ether('0')
          .sub(value)
          .sub(gasUsed)
      );

      // Check gas usage with gas token should be smaller
      expect(gasUsed).to.be.bignumber.lte(gasUsedBefore);

      // Check user gas token consumption should not exceed amount
      expect(await token.balanceOf.call(user)).to.be.bignumber.gte(
        tokenBalanceBefore.sub(amount)
      );
    });

    it('GST2 token', async function() {
      // Create a combo including gas token cube and 2 dummy kyber cubes

      // Firstly get gas cost when consume 0 gas token
      const value = ether('1');
      const config = [ZERO_BYTES32, ZERO_BYTES32, ZERO_BYTES32];
      const ruleIndex = [];
      const toBefore = [
        this.hGasTokens.address,
        this.hKyberNetwork.address,
        this.hKyberNetwork.address,
      ];
      const dataBefore = [
        abi.simpleEncode('freeGST2(uint256)', 0),
        abi.simpleEncode(
          'swapEtherToToken(uint256,address,uint256):(uint256)',
          value.div(new BN('2')),
          DAI_TOKEN,
          new BN('1')
        ),
        abi.simpleEncode(
          'swapEtherToToken(uint256,address,uint256):(uint256)',
          value.div(new BN('2')),
          DAI_TOKEN,
          new BN('1')
        ),
      ];
      const balanceUserBefore = await tracker(user);
      const receiptBefore = await this.proxy.batchExec(
        toBefore,
        config,
        dataBefore,
        ruleIndex,
        {
          from: user,
          value: value,
        }
      );
      const gasUsedBefore = new BN(receiptBefore.receipt.gasUsed);
      expect(await balanceUserBefore.delta()).to.be.bignumber.eq(
        ether('0')
          .sub(value)
          .sub(gasUsedBefore)
      );

      // Secondly get gas cost when consume 20 gas tokens
      const token = await IToken.at(GST2_TOKEN);
      const holdings = new BN('1000');
      await token.transfer(user, holdings, {
        from: GST2_PROVIDER,
      });
      await token.approve(this.proxy.address, holdings, { from: user });
      const to = [
        this.hGasTokens.address,
        this.hKyberNetwork.address,
        this.hKyberNetwork.address,
      ];
      const amount = new BN('20');
      const data = [
        abi.simpleEncode('freeGST2(uint256)', amount),
        abi.simpleEncode(
          'swapEtherToToken(uint256,address,uint256):(uint256)',
          value.div(new BN('2')),
          DAI_TOKEN,
          new BN('1')
        ),
        abi.simpleEncode(
          'swapEtherToToken(uint256,address,uint256):(uint256)',
          value.div(new BN('2')),
          DAI_TOKEN,
          new BN('1')
        ),
      ];
      const balanceUser = await tracker(user);
      const tokenBalanceBefore = await token.balanceOf.call(user);
      const receipt = await this.proxy.batchExec(to, config, data, ruleIndex, {
        from: user,
        value: value,
      });
      const gasUsed = new BN(receipt.receipt.gasUsed);

      // Check proxy token balance
      expect(await token.balanceOf.call(this.proxy.address)).to.be.zero;

      // Check user eth balance
      expect(await balanceUser.delta()).to.be.bignumber.eq(
        ether('0')
          .sub(value)
          .sub(gasUsed)
      );

      // Check gas usage with gas token should be smaller
      expect(gasUsed).to.be.bignumber.lte(gasUsedBefore);

      // Check user gas token consumption should not exceed amount
      expect(await token.balanceOf.call(user)).to.be.bignumber.gte(
        tokenBalanceBefore.sub(amount)
      );
    });
  });
});
