const chainId = network.config.chainId;

const {
  balance,
  BN,
  constants,
  ether,
  expectEvent,
  expectRevert,
  send,
} = require('@openzeppelin/test-helpers');
const { ZERO_ADDRESS, MAX_UINT256 } = constants;
const { tracker } = balance;
const abi = require('ethereumjs-abi');
const utils = web3.utils;

const { expect } = require('chai');

const {
  DAI_TOKEN,
  USDT_TOKEN,
  NATIVE_TOKEN_ADDRESS,
  NATIVE_TOKEN_ADDRESS_PROXY,
  WRAPPED_NATIVE_TOKEN,
} = require('./utils/constants');
const {
  evmRevert,
  evmSnapshot,
  profileGas,
  getHandlerReturn,
  getCallData,
  injectEther,
  getBalanceSlotNum,
  setTokenBalance,
  mwei,
} = require('./utils/utils');

const HMath = artifacts.require('HMath');
const FeeRuleRegistry = artifacts.require('FeeRuleRegistry');
const Registry = artifacts.require('Registry');
const Proxy = artifacts.require('ProxyMock');

contract('Math', function ([_, user]) {
  let id;

  before(async function () {
    this.registry = await Registry.new();
    this.feeRuleRegistry = await FeeRuleRegistry.new('0', _);
    this.proxy = await Proxy.new(
      this.registry.address,
      this.feeRuleRegistry.address
    );
    this.hMath = await HMath.new();
    await this.registry.register(this.hMath.address, utils.asciiToHex('Math'));
  });

  beforeEach(async function () {
    id = await evmSnapshot();
  });

  afterEach(async function () {
    await evmRevert(id);
  });

  describe('Math', function () {
    it('Add', async function () {
      const a = ether('1');
      const b = ether('2');
      const to = this.hMath.address;
      const data = abi.simpleEncode('add(uint256,uint256)', a, b);
      const receipt = await this.proxy.execMock(to, data, {
        from: user,
        value: ether('1'),
      });
      const handlerReturn = getHandlerReturn(receipt, ['uint256'])[0];

      expect(handlerReturn).to.be.bignumber.eq(a.add(b));
    });

    it('Add many', async function () {
      const a = [ether('1'), ether('2'), ether('3')];
      const to = this.hMath.address;
      const data = abi.simpleEncode('addMany(uint256[])', a);
      const receipt = await this.proxy.execMock(to, data, {
        from: user,
        value: ether('1'),
      });
      const handlerReturn = getHandlerReturn(receipt, ['uint256'])[0];

      expect(handlerReturn).to.be.bignumber.eq(a[0].add(a[1]).add(a[2]));
    });

    it('Sub', async function () {
      const a = ether('4');
      const b = ether('2');
      const to = this.hMath.address;
      const data = abi.simpleEncode('sub(uint256,uint256)', a, b);
      const receipt = await this.proxy.execMock(to, data, {
        from: user,
        value: ether('1'),
      });
      const handlerReturn = getHandlerReturn(receipt, ['uint256'])[0];

      expect(handlerReturn).to.be.bignumber.eq(a.sub(b));
    });
  });
});
