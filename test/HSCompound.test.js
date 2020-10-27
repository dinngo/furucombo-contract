const {
  balance,
  BN,
  constants,
  ether,
  expectEvent,
  expectRevert,
  time,
  send,
} = require('@openzeppelin/test-helpers');
const { tracker } = balance;
const { duration, increase, latest } = time;
const abi = require('ethereumjs-abi');
const utils = web3.utils;

const { expect } = require('chai');

const {
  DAI_TOKEN,
  DAI_PROVIDER,
  CDAI,
  CWBTC,
  CETHER,
  ETH_TOKEN,
  MAKER_PROXY_REGISTRY,
  CREATE2_FACTORY,
  FCOMPOUND_ACTIONS_SALT,
  FCOMPOUND_ACTIONS,
  COMPOUND_COMPTROLLER,
} = require('./utils/constants');
const { evmRevert, evmSnapshot, profileGas, mulPercent } = require('./utils/utils');
const { getFCompoundActionsBytecodeBySolc } = require('./utils/getBytecode');

const HSCompound = artifacts.require('HSCompound');
const Registry = artifacts.require('Registry');
const Proxy = artifacts.require('ProxyMock');
const FCompoundActions = artifacts.require('FCompoundActions');
const DSGuardFactory = artifacts.require('DSGuardFactory');
const IDSProxyRegistry = artifacts.require('IDSProxyRegistry');
const IDSProxy = artifacts.require('IDSProxy');
const ISingletonFactory = artifacts.require('ISingletonFactory');
const IComptroller = artifacts.require('IComptroller');
const ICEther = artifacts.require('ICEther');
const ICToken = artifacts.require('ICToken');
const IToken = artifacts.require('IERC20');

contract('HSCompound', function([_, user0, someone]) {
  let id;
  const tokenAddress = DAI_TOKEN;
  const cTokenAddress = CDAI;
  const providerAddress = DAI_PROVIDER;

  before(async function() {
    this.registry = await Registry.new();
    this.proxy = await Proxy.new(this.registry.address);
    this.hsCompound = await HSCompound.new();
    await this.registry.register(
      this.hsCompound.address,
      utils.asciiToHex('HSCompound')
    );
    // Use SingletonFactory to deploy FCompoundActions using CREATE2
    this.singletonFactory = await ISingletonFactory.at(CREATE2_FACTORY);
    await this.singletonFactory.deploy(
      getFCompoundActionsBytecodeBySolc(),
      FCOMPOUND_ACTIONS_SALT
    );
    this.actions = await FCompoundActions.at(FCOMPOUND_ACTIONS);
    this.dsRegistry = await IDSProxyRegistry.at(MAKER_PROXY_REGISTRY);
    // User0 build DSProxy
    await this.dsRegistry.build(user0);
    this.user0Proxy = await IDSProxy.at(
      await this.dsRegistry.proxies.call(user0)
    );
    this.factory = await DSGuardFactory.new();
    // User0 new DSGuard and set as authority to its DSProxy
    await this.factory.newGuard(true, this.proxy.address, this.user0Proxy.address, {from: user0});
    const guardAddr = await this.factory.guards(user0);
    await this.user0Proxy.setAuthority(guardAddr, {from: user0});
    this.token = await IToken.at(tokenAddress);
    this.cToken = await ICToken.at(cTokenAddress);
    this.cEther = await ICEther.at(CETHER);
    this.comptroller = await IComptroller.at(COMPOUND_COMPTROLLER);
  });

  beforeEach(async function() {
    id = await evmSnapshot();
  });

  afterEach(async function() {
    await evmRevert(id);
  });

  describe('Borrow', function() {
    beforeEach(async function() {
      // Mint
      await this.cEther.mint({
        from: _,
        value: ether('10'),
      });
      const mintBalance = await this.cEther.balanceOf.call(_);
      await this.cEther.transfer(user0, mintBalance, {
        from: _,
      });
    });

    /// We only test `enterMarket = true` since collateral and debt are both cEther in this case, 
    /// and leave the tests in `borrow token` section
    it('borrow ether', async function() {
      const cAmountIn = cUnit('300');
      const borrowAmount = ether('1');
      const to = this.hsCompound.address;
      const data = abi.simpleEncode(
        'borrow(address,address,address,uint256,uint256,bool)',
        this.user0Proxy.address,
        this.cEther.address,
        this.cEther.address,
        cAmountIn,
        borrowAmount,
        true
      );
      // Inject collateral cToken to Proxy
      await this.cEther.transfer(this.proxy.address, cAmountIn, {
        from: user0,
      });
      await this.proxy.updateTokenMock(this.cEther.address);
      const ethUser0Before = await balance.current(user0);
      // Check collateral has not entered market before
      expect(await this.comptroller.checkMembership.call(this.user0Proxy.address, this.cEther.address)).to.be.false;
      // Execute borrow
      const receipt = await this.proxy.execMock(to, data, {
        from: user0,
        value: ether('0.1'),
      });
      const collateralUser0ProxyAfter = await this.cEther.balanceOf.call(this.user0Proxy.address);
      const ethUser0ProxyAfter = await balance.current(this.user0Proxy.address);
      const ethUser0After = await balance.current(user0);
      const ethProxyAfter = await balance.current(this.proxy.address);
      const borrowBalanceAfter = await this.cEther.borrowBalanceStored.call(this.user0Proxy.address);
      // expect(await this.comptroller.checkMembership.call(this.user0Proxy.address, this.cEther.address)).to.be.true;
      expect(collateralUser0ProxyAfter).to.be.bignumber.eq(cAmountIn);
      expect(ethUser0ProxyAfter).to.be.zero;
      expect(ethProxyAfter).to.be.zero;
      expect(ethUser0After).to.be.bignumber.eq(
        ethUser0Before
          .add(borrowAmount)
          .sub(new BN(receipt.receipt.gasUsed))
      );
      expect(borrowBalanceAfter).to.be.bignumber.eq(borrowAmount);
    });

    it('borrow token with enter market', async function() {
      const cAmountIn = cUnit('300'); // cEther
      const borrowAmount = ether('10'); // token
      const to = this.hsCompound.address;
      const data = abi.simpleEncode(
        'borrow(address,address,address,uint256,uint256,bool)',
        this.user0Proxy.address,
        this.cEther.address,
        this.cToken.address,
        cAmountIn,
        borrowAmount,
        true
      );
      // Inject collateral cToken to Proxy
      await this.cEther.transfer(this.proxy.address, cAmountIn, {
        from: user0,
      });
      await this.proxy.updateTokenMock(this.cEther.address);
      const ethUser0Before = await balance.current(user0);
      // Check collateral has not entered market before
      expect(await this.comptroller.checkMembership.call(this.user0Proxy.address, this.cEther.address)).to.be.false;
      // Execute borrow
      const receipt = await this.proxy.execMock(to, data, {
        from: user0,
        value: ether('0.1'), // check function is payable
      });
      const collateralUser0ProxyAfter = await this.cEther.balanceOf.call(this.user0Proxy.address);
      const tokenUser0ProxyAfter = await this.token.balanceOf.call(
        this.user0Proxy.address
      );
      const tokenUser0After = await this.token.balanceOf.call(user0);
      const tokenProxyAfter = await this.token.balanceOf.call(this.proxy.address);
      const ethUser0After = await balance.current(user0);
      const borrowBalanceAfter = await this.cToken.borrowBalanceStored.call(this.user0Proxy.address);
      expect(collateralUser0ProxyAfter).to.be.bignumber.eq(cAmountIn);
      expect(tokenUser0ProxyAfter).to.be.zero;
      expect(tokenProxyAfter).to.be.zero;
      expect(tokenUser0After).to.be.bignumber.eq(borrowAmount);
      expect(ethUser0After).to.be.bignumber.eq(
        ethUser0Before
          .sub(new BN(receipt.receipt.gasUsed))
      );
      expect(borrowBalanceAfter).to.be.bignumber.eq(borrowAmount);
    });

    it('should revert: borrow token without enter market', async function() {
      const cAmountIn = cUnit('300'); // cEther
      const borrowAmount = ether('10'); // token
      const to = this.hsCompound.address;
      const data = abi.simpleEncode(
        'borrow(address,address,address,uint256,uint256,bool)',
        this.user0Proxy.address,
        this.cEther.address,
        this.cToken.address,
        cAmountIn,
        borrowAmount,
        false
      );
      // Inject collateral cToken to Proxy
      await this.cEther.transfer(this.proxy.address, cAmountIn, {
        from: user0,
      });
      await this.proxy.updateTokenMock(this.cEther.address);
      // Check collateral has not entered market before
      expect(await this.comptroller.checkMembership.call(this.user0Proxy.address, this.cEther.address)).to.be.false;
      // Expect to be reverted since collateral not enter market
      await expectRevert.unspecified(
        this.proxy.execMock(to, data, {
          from: user0,
        })
      );
    });

    it('should revert: not dsproxy owner', async function() {
      const cAmountIn = cUnit('300'); // cEther
      const borrowAmount = ether('10'); // token
      const to = this.hsCompound.address;
      const data = abi.simpleEncode(
        'borrow(address,address,address,uint256,uint256,bool)',
        this.user0Proxy.address,
        this.cEther.address,
        this.cToken.address,
        cAmountIn,
        borrowAmount,
        true
      );
      // Inject collateral cToken to Proxy
      await this.cEther.transfer(this.proxy.address, cAmountIn, {
        from: user0,
      });
      await this.proxy.updateTokenMock(this.cEther.address);
      // Check collateral has not entered market before
      expect(await this.comptroller.checkMembership.call(this.user0Proxy.address, this.cEther.address)).to.be.false;
      // Expect to be reverted since collateral not enter market
      await expectRevert.unspecified(
        this.proxy.execMock(to, data, {
          from: someone,
        })
      );
    });
  });

});

function cUnit(amount) {
  return (new BN(amount)).mul(new BN('100000000'));
}