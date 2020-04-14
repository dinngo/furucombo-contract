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
const utils = web3.utils;

const { expect } = require('chai');

const { CETHER } = require('./utils/constants');
const { resetAccount } = require('./utils/utils');

const HCEther = artifacts.require('HCEther');
const Registry = artifacts.require('Registry');
const Proxy = artifacts.require('ProxyMock');
const IToken = artifacts.require('IERC20');
const ICEther = artifacts.require('ICEther');

contract('CEther', function([_, deployer, user]) {
  let balanceUser;
  let balanceProxy;

  before(async function() {
    this.registry = await Registry.new();
    this.proxy = await Proxy.new(this.registry.address);
    this.hcether = await HCEther.new();
    await this.registry.register(
      this.hcether.address,
      utils.asciiToHex('CEther')
    );
    this.cether = await ICEther.at(CETHER);
  });

  beforeEach(async function() {
    await resetAccount(_);
    await resetAccount(user);
    balanceUser = await tracker(user);
    balanceProxy = await tracker(this.proxy.address);
  });

  describe('Mint', function() {
    it('normal', async function() {
      const value = ether('0.1');
      const to = this.hcether.address;
      const data = abi.simpleEncode('mint(uint256)', value);
      const rate = await this.cether.exchangeRateStored.call();
      const result = ether('0.1')
        .mul(ether('1'))
        .div(rate);
      const receipt = await this.proxy.execMock(to, data, {
        from: user,
        value: ether('0.1')
      });
      const cetherUser = await this.cether.balanceOf.call(user);
      expect(
        cetherUser.mul(new BN('1000')).divRound(result)
      ).to.be.bignumber.eq(new BN('1000'));
      expect(await balanceUser.delta()).to.be.bignumber.eq(
        ether('0')
          .sub(ether('0.1'))
          .sub(new BN(receipt.receipt.gasUsed))
      );
    });
  });
});
