const {
  balance,
  BN,
  constants,
  ether,
  expectRevert,
} = require('@openzeppelin/test-helpers');
const { tracker } = balance;
const { ZERO_BYTES32 } = constants;
const abi = require('ethereumjs-abi');
const util = require('ethereumjs-util');
const utils = web3.utils;

const { expect } = require('chai');

const {
  ETH_TOKEN,
  DAI_TOKEN,
  AAVEPROTOCOL_PROVIDER,
} = require('./utils/constants');
const {
  evmRevert,
  evmSnapshot,
  etherProviderWeth,
  tokenProviderUniV2,
} = require('./utils/utils');

const HAave = artifacts.require('HAaveProtocol');
const HMock = artifacts.require('HMock');
const HUniswap = artifacts.require('HUniswap');
const FeeRuleRegistry = artifacts.require('FeeRuleRegistry');
const Registry = artifacts.require('Registry');
const Proxy = artifacts.require('ProxyMock');
const IToken = artifacts.require('IERC20');
const ILendingPool = artifacts.require('ILendingPool');
const IProvider = artifacts.require('ILendingPoolAddressesProvider');
const Faucet = artifacts.require('Faucet');

contract('Aave flashloan', function([_, user]) {
  const tokenAddress = DAI_TOKEN;

  let id;
  let balanceUser;
  let balanceProxy;
  let providerAddress;

  before(async function() {
    providerAddress = await tokenProviderUniV2(tokenAddress);

    this.registry = await Registry.new();
    this.feeRuleRegistry = await FeeRuleRegistry.new('0', _);
    this.proxy = await Proxy.new(
      this.registry.address,
      this.feeRuleRegistry.address
    );
    this.hAave = await HAave.new();
    this.hMock = await HMock.new();
    await this.registry.register(
      this.hAave.address,
      utils.asciiToHex('Aave Protocol')
    );
    await this.registry.register(this.hMock.address, utils.asciiToHex('Mock'));
    this.provider = await IProvider.at(AAVEPROTOCOL_PROVIDER);
    const lendingPoolAddress = await this.provider.getLendingPool.call();
    this.lendingPool = await ILendingPool.at(lendingPoolAddress);
    await this.registry.registerCaller(lendingPoolAddress, this.hAave.address);
    this.faucet = await Faucet.new();

    const etherProvider = await etherProviderWeth();
    await web3.eth.sendTransaction({
      from: etherProvider,
      to: this.faucet.address,
      value: ether('1000'),
    });
  });

  beforeEach(async function() {
    id = await evmSnapshot();
    balanceUser = await tracker(user);
    balanceProxy = await tracker(this.proxy.address);
  });

  afterEach(async function() {
    await evmRevert(id);
  });

  describe('Ether', function() {
    it('normal', async function() {
      const value = ether('1');
      const testTo = [this.hMock.address];
      const testConfig = [ZERO_BYTES32];
      const testData = [
        '0x' +
          abi
            .simpleEncode('drain(address,uint256)', this.faucet.address, value)
            .toString('hex'),
      ];
      const test = web3.eth.abi.encodeParameters(
        ['address[]', 'bytes32[]', 'bytes[]'],
        [testTo, testConfig, testData]
      );
      const to = this.hAave.address;
      const data = abi.simpleEncode(
        'flashLoan(address,uint256,bytes)',
        ETH_TOKEN,
        value,
        util.toBuffer(test)
      );
      const receipt = await this.proxy.execMock(to, data, {
        from: user,
        value: ether('0.1'),
      });
      expect(await balanceUser.delta()).to.be.bignumber.eq(
        value
          .sub(value.mul(new BN('9')).div(new BN('10000')))
          .sub(new BN(receipt.receipt.gasUsed))
      );
    });
  });

  describe('Token', function() {
    before(async function() {
      this.token = await IToken.at(tokenAddress);
      await this.token.transfer(this.faucet.address, ether('1000'), {
        from: providerAddress,
      });
    });

    let tokenUser;

    beforeEach(async function() {
      tokenUser = await this.token.balanceOf.call(user);
    });

    it('normal', async function() {
      const value = ether('1');
      const testTo = [this.hMock.address];
      const testConfig = [ZERO_BYTES32];
      const testData = [
        '0x' +
          abi
            .simpleEncode(
              'drainToken(address,address,uint256)',
              this.faucet.address,
              tokenAddress,
              value
            )
            .toString('hex'),
      ];
      const test = web3.eth.abi.encodeParameters(
        ['address[]', 'bytes32[]', 'bytes[]'],
        [testTo, testConfig, testData]
      );
      const to = this.hAave.address;
      const data = abi.simpleEncode(
        'flashLoan(address,uint256,bytes)',
        DAI_TOKEN,
        value,
        util.toBuffer(test)
      );
      const receipt = await this.proxy.execMock(to, data, {
        from: user,
        value: ether('0.1'),
      });
      expect(await balanceUser.delta()).to.be.bignumber.eq(
        ether('0').sub(new BN(receipt.receipt.gasUsed))
      );
      expect(await this.token.balanceOf.call(user)).to.be.bignumber.eq(
        tokenUser.add(value).sub(value.mul(new BN('9')).div(new BN('10000')))
      );
    });
  });

  describe('Multiple', function() {
    before(async function() {
      this.token = await IToken.at(tokenAddress);
      await this.token.transfer(this.faucet.address, ether('1000'), {
        from: providerAddress,
      });
    });

    let tokenUser;

    beforeEach(async function() {
      tokenUser = await this.token.balanceOf.call(user);
    });

    it('sequential', async function() {
      const value = ether('1');
      const test1To = [this.hMock.address];
      const test1Config = [ZERO_BYTES32];
      const test1Data = [
        '0x' +
          abi
            .simpleEncode('drain(address,uint256)', this.faucet.address, value)
            .toString('hex'),
      ];
      const test1 = web3.eth.abi.encodeParameters(
        ['address[]', 'bytes32[]', 'bytes[]'],
        [test1To, test1Config, test1Data]
      );

      const test2To = [this.hMock.address];
      const test2Config = [ZERO_BYTES32];
      const test2Data = [
        '0x' +
          abi
            .simpleEncode(
              'drainToken(address,address,uint256)',
              this.faucet.address,
              tokenAddress,
              value
            )
            .toString('hex'),
      ];
      const test2 = web3.eth.abi.encodeParameters(
        ['address[]', 'bytes32[]', 'bytes[]'],
        [test2To, test2Config, test2Data]
      );

      const to = [this.hAave.address, this.hAave.address];
      const config = [ZERO_BYTES32, ZERO_BYTES32];
      const ruleIndex = [];
      const data = [
        abi.simpleEncode(
          'flashLoan(address,uint256,bytes)',
          ETH_TOKEN,
          value,
          util.toBuffer(test1)
        ),
        abi.simpleEncode(
          'flashLoan(address,uint256,bytes)',
          DAI_TOKEN,
          value,
          util.toBuffer(test2)
        ),
      ];

      const receipt = await this.proxy.batchExec(to, config, data, ruleIndex, {
        from: user,
        value: ether('0.1'),
      });
      expect(await balanceUser.delta()).to.be.bignumber.eq(
        value
          .sub(value.mul(new BN('9')).div(new BN('10000')))
          .sub(new BN(receipt.receipt.gasUsed))
      );
      expect(await this.token.balanceOf.call(user)).to.be.bignumber.eq(
        tokenUser.add(value).sub(value.mul(new BN('9')).div(new BN('10000')))
      );
    });

    it('nested', async function() {
      const value = ether('1');
      const execTo = [this.hMock.address, this.hMock.address];
      const execConfig = [ZERO_BYTES32, ZERO_BYTES32];
      const execData = [
        '0x' +
          abi
            .simpleEncode('drain(address,uint256)', this.faucet.address, value)
            .toString('hex'),
        '0x' +
          abi
            .simpleEncode(
              'drainToken(address,address,uint256)',
              this.faucet.address,
              tokenAddress,
              value
            )
            .toString('hex'),
      ];
      const exec = web3.eth.abi.encodeParameters(
        ['address[]', 'bytes32[]', 'bytes[]'],
        [execTo, execConfig, execData]
      );
      const flashTokenTo = [this.hAave.address];
      const flashConfig = [ZERO_BYTES32];
      const flashTokenData = [
        '0x' +
          abi
            .simpleEncode(
              'flashLoan(address,uint256,bytes)',
              DAI_TOKEN,
              value,
              util.toBuffer(exec)
            )
            .toString('hex'),
      ];
      const flashToken = web3.eth.abi.encodeParameters(
        ['address[]', 'bytes32[]', 'bytes[]'],
        [flashTokenTo, flashConfig, flashTokenData]
      );
      const to = this.hAave.address;
      const data = abi.simpleEncode(
        'flashLoan(address,uint256,bytes)',
        ETH_TOKEN,
        value,
        util.toBuffer(flashToken)
      );
      await expectRevert(
        this.proxy.execMock(to, data, {
          from: user,
          value: ether('0.1'),
        }),
        'reentrant call'
      );
    });
  });

  describe('executeOperation', function() {
    it('should revert: non-lending pool call executeOperation() directly', async function() {
      const data = abi.simpleEncode(
        'executeOperation(address,uint256,uint256,bytes)',
        DAI_TOKEN,
        new BN(100),
        new BN(1),
        util.toBuffer(0)
      );

      const to = this.hAave.address;
      await expectRevert(
        this.proxy.execMock(to, data, {
          from: user,
        }),
        'HAaveProtocol_executeOperation: invalid caller'
      );
    });
  });
});
