const {
  balance,
  BN,
  constants,
  ether,
  expectEvent,
  expectRevert,
  time,
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
  AAVEPROTOCOL_PROVIDER,
  AETHER,
  ADAI
} = require('./utils/constants');
const { resetAccount, profileGas } = require('./utils/utils');

const HAave = artifacts.require('HAaveProtocol');
const Registry = artifacts.require('Registry');
const Proxy = artifacts.require('ProxyMock');
const IToken = artifacts.require('IERC20');
const IAToken = artifacts.require('IAToken');
const ILendingPool = artifacts.require('ILendingPool');
const IProvider = artifacts.require('ILendingPoolAddressesProvider');

contract('Aave', function([_, deployer, user]) {
  const atokenAddress = ADAI;
  const tokenAddress = DAI_TOKEN;
  const providerAddress = DAI_PROVIDER;
  
  let balanceUser;
  let balanceProxy;
  let aetherUser;
  let atokenUser;

  before(async function() {
    this.registry = await Registry.new();
    this.proxy = await Proxy.new(this.registry.address);
    this.haave = await HAave.new();
    await this.registry.register(
      this.haave.address,
      utils.asciiToHex('Aave Protocol')
    );
    this.provider = await IProvider.at(AAVEPROTOCOL_PROVIDER);
    const lendingPoolAddress = await this.provider.getLendingPool.call();
    this.lendingPool = await ILendingPool.at(lendingPoolAddress);
    await this.registry.register(lendingPoolAddress, this.haave.address);
    this.aether = await IAToken.at(AETHER);
    this.token = await IToken.at(tokenAddress);
    this.atoken = await IAToken.at(atokenAddress);
  });

  beforeEach(async function() {
    await resetAccount(_);
    await resetAccount(user);
    balanceUser = await tracker(user);
    balanceProxy = await tracker(this.proxy.address);
  });

  describe('Deposit', function() {
    it('ETH', async function() {
      const value = ether('10');
      const to = this.haave.address;
      const data = abi.simpleEncode(
        'deposit(address,uint256)',
        ETH_TOKEN,
        value
      );
      const receipt = await this.proxy.execMock(
        to, 
        data, 
        { from: user, value: value }
      );
      const aetherUser = await this.aether.balanceOf.call(user);

      console.log('AETHER balance: ' + aetherUser);
      console.log('value: ' + value);
      expect(aetherUser).to.be.bignumber.eq(new BN(value));
      expect(await balanceUser.delta()).to.be.bignumber.eq(
        ether('0')
          .sub(new BN(value))
          .sub(new BN(receipt.receipt.gasUsed))
      );
      profileGas(receipt);
    });

    it('DAI', async function() {
      const value = ether('999');
      const to = this.haave.address;
      const data = abi.simpleEncode(
        'deposit(address,uint256)',
        tokenAddress,
        value
      );

      await this.token.transfer(this.proxy.address, value, {
        from: providerAddress,
      });
      await this.proxy.updateTokenMock(this.token.address);

      const receipt = await this.proxy.execMock(
        to, 
        data, 
        { from: user}
      );
      const atokenUser = await this.atoken.balanceOf.call(user);

      console.log('AToken balance: ' + atokenUser);
      console.log('value: ' + value);
      expect(atokenUser).to.be.bignumber.eq(new BN(value));
      expect(await balanceUser.delta()).to.be.bignumber.eq(
        ether('0').sub(new BN(receipt.receipt.gasUsed))
      );
      profileGas(receipt);
    });

    it('revert', async function() {
      const value = ether('10');
      const to = this.haave.address;
      const data = abi.simpleEncode(
        'deposit(address,uint256)',
        '0x0000000000000000000000000000000000000000',
        value
      );
      await expectRevert.unspecified(
        this.proxy.execMock(to, data, { from: user, value: value })
      );
    });
  });

});
