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

const { CDAI, DAI_TOKEN, DAI_PROVIDER } = require('./utils/constants');
const { resetAccount } = require('./utils/utils');

const HCToken = artifacts.require('HCToken');
const Registry = artifacts.require('Registry');
const Proxy = artifacts.require('ProxyMock');
const IToken = artifacts.require('IERC20');
const ICToken = artifacts.require('ICToken');

contract('CToken', function([_, deployer, user]) {
  const ctokenAddress = CDAI;
  const tokenAddress = DAI_TOKEN;
  const providerAddress = DAI_PROVIDER;

  let balanceUser;
  let balanceProxy;

  before(async function() {
    this.registry = await Registry.new();
    this.proxy = await Proxy.new(this.registry.address);
    this.hctoken = await HCToken.new();
    await this.registry.register(
      this.hctoken.address,
      utils.asciiToHex('CToken')
    );
    this.token = await IToken.at(tokenAddress);
    this.ctoken = await ICToken.at(ctokenAddress);
  });

  beforeEach(async function() {
    await resetAccount(_);
    await resetAccount(user);
    balanceUser = await tracker(user);
    balanceProxy = await tracker(this.proxy.address);
  });

  describe('Mint', function() {
    it('normal', async function() {
      const value = ether('10');
      const to = this.hctoken.address;
      const data = abi.simpleEncode(
        'mint(address,uint256)',
        ctokenAddress,
        value
      );
      await this.token.transfer(this.proxy.address, value, {
        from: providerAddress
      });
      await this.proxy.updateTokenMock(this.token.address);

      const rate = await this.ctoken.exchangeRateStored.call();
      const result = value.mul(ether('1')).div(rate);
      const receipt = await this.proxy.execMock(to, data, { from: user });
      const ctokenUser = await this.ctoken.balanceOf.call(user);
      expect(
        ctokenUser.mul(new BN('1000')).divRound(result)
      ).to.be.bignumber.eq(new BN('1000'));
      expect(await balanceUser.delta()).to.be.bignumber.eq(
        ether('0').sub(new BN(receipt.receipt.gasUsed))
      );
    });
  });
});
