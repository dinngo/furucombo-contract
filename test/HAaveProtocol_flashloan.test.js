const {
  balance,
  BN,
  constants,
  ether,
  expectEvent,
  expectRevert,
  time
} = require('@openzeppelin/test-helpers');
const { tracker } = balance;
const { latest } = time;
const abi = require('ethereumjs-abi');
const util = require('ethereumjs-util');
const utils = web3.utils;

const { expect } = require('chai');

const {
  ETH_TOKEN,
  ETH_PROVIDER,
  DAI_TOKEN,
  DAI_PROVIDER,
  AAVEPROTOCOL_PROVIDER
} = require('./utils/constants');
const { resetAccount } = require('./utils/utils');

const HAave = artifacts.require('HAaveProtocol');
const HMock = artifacts.require('HMock');
const HUniswap = artifacts.require('HUniswap');
const Registry = artifacts.require('Registry');
const Proxy = artifacts.require('ProxyMock');
const IToken = artifacts.require('IERC20');
const ILendingPool = artifacts.require('ILendingPool');
const IProvider = artifacts.require('ILendingPoolAddressesProvider');
const IUniswapExchange = artifacts.require('IUniswapExchange');
const Faucet = artifacts.require('Faucet');

contract('Aave flashloan', function([_, deployer, user]) {
  let balanceUser;
  let balanceProxy;

  before(async function() {
    this.registry = await Registry.new();
    this.proxy = await Proxy.new(this.registry.address);
    this.haave = await HAave.new();
    this.hmock = await HMock.new();
    await this.registry.register(
      this.haave.address,
      utils.asciiToHex('Aave Protocol')
    );
    await this.registry.register(this.hmock.address, utils.asciiToHex('Mock'));
    this.provider = await IProvider.at(AAVEPROTOCOL_PROVIDER);
    const lendingPoolAddress = await this.provider.getLendingPool.call();
    this.lendingPool = await ILendingPool.at(lendingPoolAddress);
    await this.registry.register(lendingPoolAddress, this.haave.address);
    this.faucet = await Faucet.new();
    await web3.eth.sendTransaction({
      from: ETH_PROVIDER,
      to: this.faucet.address,
      value: ether('1000')
    });
  });

  beforeEach(async function() {
    await resetAccount(_);
    await resetAccount(user);
    balanceUser = await tracker(user);
    balanceProxy = await tracker(this.proxy.address);
  });

  describe('Ether', function() {
    it('normal', async function() {
      const value = ether('1');
      const testTo = [this.hmock.address];
      const testData = [
        '0x' +
          abi
            .simpleEncode('drain(address,uint256)', this.faucet.address, value)
            .toString('hex')
      ];
      const test = web3.eth.abi.encodeParameters(
        ['address[]', 'bytes[]'],
        [testTo, testData]
      );
      const to = this.haave.address;
      const data = abi.simpleEncode(
        'flashLoan(address,uint256,bytes)',
        ETH_TOKEN,
        value,
        util.toBuffer(test)
      );
      const receipt = await this.proxy.execMock(to, data, {
        from: user,
        value: ether('0.1')
      });
      expect(await balanceUser.delta()).to.be.bignumber.eq(
        value
          .sub(value.mul(new BN('9')).div(new BN('10000')))
          .sub(new BN(receipt.receipt.gasUsed))
      );
    });
  });

  describe('Token', function() {
    const tokenAddress = DAI_TOKEN;
    const tokenProvider = DAI_PROVIDER;

    before(async function() {
      this.token = await IToken.at(tokenAddress);
      await this.token.transfer(this.faucet.address, ether('1000'), {
        from: tokenProvider
      });
    });

    let tokenUser;

    beforeEach(async function() {
      tokenUser = await this.token.balanceOf.call(user);
    });

    it('normal', async function() {
      const value = ether('1');
      const testTo = [this.hmock.address];
      const testData = [
        '0x' +
          abi
            .simpleEncode(
              'drainToken(address,address,uint256)',
              this.faucet.address,
              tokenAddress,
              value
            )
            .toString('hex')
      ];
      const test = web3.eth.abi.encodeParameters(
        ['address[]', 'bytes[]'],
        [testTo, testData]
      );
      const to = this.haave.address;
      const data = abi.simpleEncode(
        'flashLoan(address,uint256,bytes)',
        DAI_TOKEN,
        value,
        util.toBuffer(test)
      );
      const receipt = await this.proxy.execMock(to, data, {
        from: user,
        value: ether('0.1')
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
    const tokenAddress = DAI_TOKEN;
    const tokenProvider = DAI_PROVIDER;

    before(async function() {
      this.token = await IToken.at(tokenAddress);
      await this.token.transfer(this.faucet.address, ether('1000'), {
        from: tokenProvider
      });
    });

    let tokenUser;

    beforeEach(async function() {
      tokenUser = await this.token.balanceOf.call(user);
    });

    it('sequential', async function() {
      const value = ether('1');
      const test1To = [this.hmock.address];
      const test1Data = [
        '0x' +
          abi
            .simpleEncode('drain(address,uint256)', this.faucet.address, value)
            .toString('hex')
      ];
      const test1 = web3.eth.abi.encodeParameters(
        ['address[]', 'bytes[]'],
        [test1To, test1Data]
      );

      const test2To = [this.hmock.address];
      const test2Data = [
        '0x' +
          abi
            .simpleEncode(
              'drainToken(address,address,uint256)',
              this.faucet.address,
              tokenAddress,
              value
            )
            .toString('hex')
      ];
      const test2 = web3.eth.abi.encodeParameters(
        ['address[]', 'bytes[]'],
        [test2To, test2Data]
      );

      const to = [this.haave.address, this.haave.address];
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
        )
      ];

      const receipt = await this.proxy.batchExec(to, data, {
        from: user,
        value: ether('0.1')
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
      const execTo = [this.hmock.address, this.hmock.address];
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
            .toString('hex')
      ];
      const exec = web3.eth.abi.encodeParameters(
        ['address[]', 'bytes[]'],
        [execTo, execData]
      );
      const flashTokenTo = [this.haave.address];
      const flashTokenData = [
        '0x' +
          abi
            .simpleEncode(
              'flashLoan(address,uint256,bytes)',
              DAI_TOKEN,
              value,
              util.toBuffer(exec)
            )
            .toString('hex')
      ];
      const flashToken = web3.eth.abi.encodeParameters(
        ['address[]', 'bytes[]'],
        [flashTokenTo, flashTokenData]
      );
      const to = this.haave.address;
      const data = abi.simpleEncode(
        'flashLoan(address,uint256,bytes)',
        ETH_TOKEN,
        value,
        util.toBuffer(flashToken)
      );
      await expectRevert(
        this.proxy.execMock(to, data, {
          from: user,
          value: ether('0.1')
        }),
        'reentrant call'
      );
    });
  });
});
