const { balance, ether, time } = require('@openzeppelin/test-helpers');
const { tracker } = balance;
const { duration, increase } = time;
const abi = require('ethereumjs-abi');
const utils = web3.utils;

const { expect } = require('chai');

const {
  CETHER,
  COMP_TOKEN,
  COMPOUND_COMPTROLLER,
  COMPOUND_LENS,
} = require('./utils/constants');
const {
  evmRevert,
  evmSnapshot,
  profileGas,
  getHandlerReturn,
} = require('./utils/utils');

const HComptroller = artifacts.require('HComptroller');
const FeeRuleRegistry = artifacts.require('FeeRuleRegistry');
const Registry = artifacts.require('Registry');
const Proxy = artifacts.require('ProxyMock');
const IToken = artifacts.require('IERC20');
const ICEther = artifacts.require('ICEther');
const IComptroller = artifacts.require('IComptroller');

async function getEstimatedComp(account) {
  const data = web3.eth.abi.encodeFunctionCall(
    {
      constant: false,
      inputs: [
        { name: 'comp', type: 'address' },
        {
          name: 'comptroller',
          type: 'address',
        },
        { name: 'account', type: 'address' },
      ],
      name: 'getCompBalanceMetadataExt',
      payable: false,
      stateMutability: 'nonpayable',
      type: 'function',
    },
    [COMP_TOKEN, COMPOUND_COMPTROLLER, account]
  );
  const result = await web3.eth.call({
    from: account,
    to: COMPOUND_LENS,
    data: data,
  });
  const d = web3.eth.abi.decodeParameters(
    ['uint256', 'uint256', 'address', 'uint256'],
    result
  );
  return d['3'];
}

contract('Comptroller', function([_, user, someone]) {
  let id;
  let balanceUser;
  let balanceProxy;
  let compUser;

  before(async function() {
    this.registry = await Registry.new();
    this.feeRuleRegistry = await FeeRuleRegistry.new('0', _);
    this.proxy = await Proxy.new(this.registry.address, this.feeRuleRegistry.address);
    this.hComptroller = await HComptroller.new();
    await this.registry.register(
      this.hComptroller.address,
      utils.asciiToHex('Comptroller')
    );
    this.cEther = await ICEther.at(CETHER);
    this.comp = await IToken.at(COMP_TOKEN);
    this.comptroller = await IComptroller.at(COMPOUND_COMPTROLLER);
  });

  beforeEach(async function() {
    id = await evmSnapshot();
    balanceUser = await tracker(user);
    balanceProxy = await tracker(this.proxy.address);
  });

  afterEach(async function() {
    await evmRevert(id);
  });

  describe('Claim COMP', function() {
    before(async function() {
      await this.comptroller.claimComp(user);
    });

    beforeEach(async function() {
      await this.cEther.mint({
        from: user,
        value: ether('10'),
      });
      await increase(duration.days(1));
      compUser = await this.comp.balanceOf.call(user);
    });

    describe('Owner claim', function() {
      it('normal', async function() {
        const to = this.hComptroller.address;
        const data = abi.simpleEncode('claimComp()');
        const result = await getEstimatedComp(user);
        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: ether('0.1'),
        });
        // Get handler return result
        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );

        const compUserEnd = await this.comp.balanceOf.call(user);
        expect(compUserEnd.sub(compUser)).to.be.bignumber.eq(handlerReturn);
        // TODO: Get the ground truth
        // expect(compUserEnd.sub(compUser)).to.be.bignumber.eq(result);
        expect(compUserEnd.sub(compUser)).to.be.bignumber.gt(ether('0'));
        profileGas(receipt);
      });
    });

    describe('Others claim', function() {
      it('normal', async function() {
        const to = this.hComptroller.address;
        const data = abi.simpleEncode('claimComp(address)', user);
        const result = await getEstimatedComp(user);
        const receipt = await this.proxy.execMock(to, data, {
          from: someone,
          value: ether('0.1'),
        });
        // Get handler return result
        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );
        const compUserEnd = await this.comp.balanceOf.call(user);
        expect(compUserEnd.sub(compUser)).to.be.bignumber.eq(handlerReturn);
        // TODO: Get the ground truth
        // expect(compUserEnd.sub(compUser)).to.be.bignumber.eq(result);
        expect(compUserEnd.sub(compUser)).to.be.bignumber.gt(ether('0'));
        profileGas(receipt);
      });
    });
  });
});
