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
  BAT_TOKEN,
  AAVEPROTOCOL_PROVIDER
} = require('./utils/constants');
const { resetAccount } = require('./utils/utils');

const HAave = artifacts.require('HAaveProtocol');
const HMock = artifacts.require('HMock');
const Registry = artifacts.require('Registry');
const Proxy = artifacts.require('Proxy');
const IToken = artifacts.require('IERC20');
const ILendingPool = artifacts.require('ILendingPool');
const IProvider = artifacts.require('ILendingPoolAddressesProvider');

contract('Aave flashloan', function([_, deployer, user1]) {
  let balanceUser1;
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
    const lendingPoolCoreAddress = await this.provider.getLendingPoolCore.call();
    this.lendingPool = await ILendingPool.at(lendingPoolAddress);
    await this.registry.register(lendingPoolAddress, this.haave.address);
    await this.registry.register(lendingPoolCoreAddress, this.haave.address);
  });

  beforeEach(async function() {
    await resetAccount(_);
    await resetAccount(user1);
    balanceUser1 = await tracker(user1);
    balanceProxy = await tracker(this.proxy.address);
  });

  describe('Ether', function() {
    it('normal', async function() {
      const value = [ether('1')];
      const testTo = [this.hmock.address];
      const testData = [
        '0x' + abi.simpleEncode('test(uint256)', ether('0.01')).toString('hex')
      ];
      const test = web3.eth.abi.encodeParameters(
        ['address[]', 'bytes[]'],
        [testTo, testData]
      );
      const to = [this.haave.address];
      const data = [
        abi.simpleEncode(
          'flashLoan(address,uint256,bytes)',
          ETH_TOKEN,
          value[0],
          util.toBuffer(test)
        )
      ];
      const { logs } = await this.proxy.batchExec(to, data, {
        from: user1,
        value: ether('0.1')
      });
    });
  });
});
