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

contract('CToken', function([_, deployer, user1]) {
  const ctokenAddress = CDAI;
  const tokenAddress = DAI_TOKEN;
  const providerAddress = DAI_PROVIDER;

  let balanceUser1;
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
    await resetAccount(user1);
    balanceUser1 = await tracker(user1);
    balanceProxy = await tracker(this.proxy.address);
  });

  describe('Mint', function() {
    it('normal', async function() {
      const value = [ether('10')];
      const to = [this.hctoken.address];
      const data = [
        abi.simpleEncode('mint(address,uint256)', ctokenAddress, value[0])
      ];
      await this.token.transfer(this.proxy.address, value[0], {
        from: providerAddress
      });

      const rate = await this.ctoken.exchangeRateStored.call();
      const result = value[0].mul(ether('1')).div(rate);
      const receipt = await this.proxy.batchExec(to, data, { from: user1 });
      const ctokenUser1 = await this.ctoken.balanceOf.call(user1);
      expect(
        ctokenUser1.mul(new BN('1000')).divRound(result)
      ).to.be.bignumber.eq(new BN('1000'));
      expect(await balanceUser1.delta()).to.be.bignumber.eq(
        ether('0').sub(new BN(receipt.receipt.gasUsed))
      );
    });
  });
});
