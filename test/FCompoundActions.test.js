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

const FCompoundActions = artifacts.require('FCompoundActions');
const IDSProxyRegistry = artifacts.require('IDSProxyRegistry');
const IDSProxy = artifacts.require('IDSProxy');
const ISingletonFactory = artifacts.require('ISingletonFactory');
const IComptroller = artifacts.require('IComptroller');
const ICEther = artifacts.require('ICEther');
const ICToken = artifacts.require('ICToken');
const IToken = artifacts.require('IERC20');

contract('FCompoundActions', function([_, user0]) {
  let id;
  const tokenAddress = DAI_TOKEN;
  const cTokenAddress = CDAI;
  const providerAddress = DAI_PROVIDER;

  before(async function() {
    // Use SingletonFactory to deploy FCompoundActions using CREATE2
    this.singletonFactory = await ISingletonFactory.at(CREATE2_FACTORY);

    //   const addr = await this.singletonFactory.deploy.call(
    //     getFCompoundActionsBytecodeBySolc(),
    //     FCOMPOUND_ACTIONS_SALT
    //   );
    //   console.log(`addrs = ${addr}`);

    await this.singletonFactory.deploy(
      getFCompoundActionsBytecodeBySolc(),
      FCOMPOUND_ACTIONS_SALT
    );
    this.actions = await FCompoundActions.at(FCOMPOUND_ACTIONS);
    this.dsRegistry = await IDSProxyRegistry.at(MAKER_PROXY_REGISTRY);
    await this.dsRegistry.build(user0);
    this.user0Proxy = await IDSProxy.at(
      await this.dsRegistry.proxies.call(user0)
    );
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

  describe('Deposit', function() {
    it('normal', async function() {
      const amount = ether('10');
      const data = abi.simpleEncode(
        'deposit(address,uint256)',
        this.token.address,
        amount
      );
      await this.token.transfer(user0, amount, { from: providerAddress });
      await this.token.approve(this.user0Proxy.address, amount, {
        from: user0,
      });
      const tokenProxyBefore = await this.token.balanceOf.call(
        this.user0Proxy.address
      );
      const tokenUser0Before = await this.token.balanceOf.call(user0);

      const receipt = await this.user0Proxy.execute(FCOMPOUND_ACTIONS, data, {
        from: user0,
      });

      const tokenProxyAfter = await this.token.balanceOf.call(
        this.user0Proxy.address
      );
      const tokenUser0After = await this.token.balanceOf.call(user0);
      expect(tokenProxyAfter).to.be.bignumber.eq(tokenProxyBefore.add(amount));
      expect(tokenUser0After).to.be.bignumber.eq(tokenUser0Before.sub(amount));
    });
  });

  describe('Withdraw', function() {
    it('withdraw ether', async function() {
      const amount = ether('1');
      const data = abi.simpleEncode(
        'withdraw(address,uint256)',
        ETH_TOKEN,
        amount
      );
      await send.ether(_, this.user0Proxy.address, amount);
      const ethProxyBefore = await balance.current(this.user0Proxy.address);
      const ethUser0Before = await balance.current(user0);

      const receipt = await this.user0Proxy.execute(FCOMPOUND_ACTIONS, data, {
        from: user0,
      });

      const ethProxyAfter = await balance.current(this.user0Proxy.address);
      const ethUser0After = await balance.current(user0);
      expect(ethProxyAfter).to.be.bignumber.eq(ethProxyBefore.sub(amount));
      expect(ethUser0After).to.be.bignumber.eq(
        ethUser0Before.add(amount).sub(new BN(receipt.receipt.gasUsed))
      );
    });

    it('withdraw token', async function() {
      const amount = ether('10');
      const data = abi.simpleEncode(
        'withdraw(address,uint256)',
        this.token.address,
        amount
      );
      await this.token.transfer(this.user0Proxy.address, amount, {
        from: providerAddress,
      });
      const tokenProxyBefore = await this.token.balanceOf.call(
        this.user0Proxy.address
      );
      const tokenUser0Before = await this.token.balanceOf.call(user0);

      const receipt = await this.user0Proxy.execute(FCOMPOUND_ACTIONS, data, {
        from: user0,
      });

      const tokenProxyAfter = await this.token.balanceOf.call(
        this.user0Proxy.address
      );
      const tokenUser0After = await this.token.balanceOf.call(user0);
      expect(tokenProxyAfter).to.be.bignumber.eq(tokenProxyBefore.sub(amount));
      expect(tokenUser0After).to.be.bignumber.eq(tokenUser0Before.add(amount));
    });
  });

  describe('Market', function() {
    it('enter single', async function() {
      const isEnteredBefore = await this.comptroller.checkMembership.call(
        this.user0Proxy.address,
        this.cToken.address
      );
      expect(isEnteredBefore).to.be.false;
      const data = abi.simpleEncode(
        'enterMarket(address)',
        this.cToken.address
      );
      // User DSProxy enter market
      await this.user0Proxy.execute(FCOMPOUND_ACTIONS, data, { from: user0 });
      const isEnteredAfter = await this.comptroller.checkMembership.call(
        this.user0Proxy.address,
        this.cToken.address
      );
      expect(isEnteredAfter).to.be.true;
    });

    it('enter multiple', async function() {
      const isEnteredBefore0 = await this.comptroller.checkMembership.call(
        this.user0Proxy.address,
        this.cToken.address
      );
      const isEnteredBefore1 = await this.comptroller.checkMembership.call(
        this.user0Proxy.address,
        CWBTC
      );
      expect(isEnteredBefore0).to.be.false;
      expect(isEnteredBefore1).to.be.false;
      const data = abi.simpleEncode(
        'enterMarkets(address[])',
        [this.cToken.address, CWBTC]
      );
      // User DSProxy enter market
      await this.user0Proxy.execute(FCOMPOUND_ACTIONS, data, { from: user0 });
      const isEnteredAfter0 = await this.comptroller.checkMembership.call(
        this.user0Proxy.address,
        this.cToken.address
      );
      const isEnteredAfter1 = await this.comptroller.checkMembership.call(
        this.user0Proxy.address,
        CWBTC
      );
      expect(isEnteredAfter0).to.be.true;
      expect(isEnteredAfter1).to.be.true;
    });

    it('should revert: non cToken enter', async function() {
      const data = abi.simpleEncode(
        'enterMarket(address)',
        this.token.address
      );
      // User DSProxy enter market
      await expectRevert.unspecified( // TODO: check how to be specified and remove `.unspecified`
        this.user0Proxy.execute(FCOMPOUND_ACTIONS, data, { from: user0 }),
        "FCompoundActions: enter markets failed"
      );
    });

    it('exit', async function() {
      const dataEnter = abi.simpleEncode(
        'enterMarket(address)',
        this.cToken.address
      );
      // User DSProxy enter market
      await this.user0Proxy.execute(FCOMPOUND_ACTIONS, dataEnter, { from: user0 });
      const isEnteredBefore = await this.comptroller.checkMembership.call(
        this.user0Proxy.address,
        this.cToken.address
      );
      expect(isEnteredBefore).to.be.true;
      const data = abi.simpleEncode(
        'exitMarket(address)',
        this.cToken.address
      );
      // User DSProxy exit market
      await this.user0Proxy.execute(FCOMPOUND_ACTIONS, data, { from: user0 });
      const isEnteredAfter = await this.comptroller.checkMembership.call(
        this.user0Proxy.address,
        this.cToken.address
      );
      expect(isEnteredAfter).to.be.false;
    });

    it('should revert: non cToken exit', async function() {
      const data = abi.simpleEncode(
        'exitMarket(address)',
        this.token.address
      );
      // User DSProxy exit market
      await expectRevert.unspecified( // TODO: check how to be specified and remove `.unspecified`
        this.user0Proxy.execute(FCOMPOUND_ACTIONS, data, { from: user0 }),
        "FCompoundActions: exit markets failed"
      );
    });
  });

  describe('Borrow', function() {
    beforeEach(async function() {
      // Mint
      await this.cEther.mint({
        from: _,
        value: ether('10'),
      });
      const mintBalance = await this.cEther.balanceOf.call(_);
      await this.cEther.transfer(this.user0Proxy.address, mintBalance, {
        from: _,
      });
      // Enter
      const data = abi.simpleEncode(
        'enterMarket(address)',
        this.cEther.address
      );
      await this.user0Proxy.execute(FCOMPOUND_ACTIONS, data, { from: user0 });
    });

    it('borrow ether', async function() {
      const borrowAddress = this.cEther.address;
      const amount = ether('1');
      const data = abi.simpleEncode(
        'borrow(address,uint256)',
        borrowAddress,
        amount
      );

      const ethProxyBefore = await balance.current(this.user0Proxy.address);
      const ethUser0Before = await balance.current(user0);

      const receipt = await this.user0Proxy.execute(FCOMPOUND_ACTIONS, data, {
        from: user0,
      });

      const ethProxyAfter = await balance.current(this.user0Proxy.address);
      const ethUser0After = await balance.current(user0);
      expect(ethProxyAfter).to.be.bignumber.eq(ethProxyBefore.add(amount));
      expect(ethUser0After).to.be.bignumber.eq(
        ethUser0Before.sub(new BN(receipt.receipt.gasUsed))
      );
    });

    it('borrow token', async function() {
      const borrowAddress = this.cToken.address;
      const amount = ether('10');
      const data = abi.simpleEncode(
        'borrow(address,uint256)',
        borrowAddress,
        amount
      );

      const tokenProxyBefore = await this.token.balanceOf.call(
        this.user0Proxy.address
      );
      const tokenUser0Before = await this.token.balanceOf.call(user0);

      const receipt = await this.user0Proxy.execute(FCOMPOUND_ACTIONS, data, {
        from: user0,
      });

      const tokenProxyAfter = await this.token.balanceOf.call(
        this.user0Proxy.address
      );
      const tokenUser0After = await this.token.balanceOf.call(user0);
      expect(tokenProxyAfter).to.be.bignumber.eq(tokenProxyBefore.add(amount));
      expect(tokenUser0After).to.be.bignumber.eq(tokenUser0Before);
    });
  });

  describe('Repay', function() {
    describe('Repay Ether', function() {
      const mintAmount = ether('10');
      const borrowAmount = ether('1');
      beforeEach(async function() {
        // Mint
        await this.cEther.mint({
          from: _,
          value: mintAmount,
        });
        const mintBalance = await this.cEther.balanceOf.call(_);
        await this.cEther.transfer(this.user0Proxy.address, mintBalance, {
          from: _,
        });
        // Enter
        const dataEnter = abi.simpleEncode(
          'enterMarket(address)',
          this.cEther.address
        );
        await this.user0Proxy.execute(FCOMPOUND_ACTIONS, dataEnter, { from: user0 });
        // Borrow
        const dataBorrow = abi.simpleEncode(
          'borrow(address,uint256)',
          this.cEther.address,
          borrowAmount
        );
        await this.user0Proxy.execute(FCOMPOUND_ACTIONS, dataBorrow, {
          from: user0,
        });
        expect(await this.cEther.borrowBalanceStored.call(this.user0Proxy.address)).to.be.bignumber.eq(borrowAmount);
      });
  
      it('repay ether partial', async function() {
        const amount = ether('0.5');
        const data = abi.simpleEncode(
          'repayBorrow(address,uint256)',
          this.cEther.address,
          amount
        );
  
        const ethProxyBefore = await balance.current(this.user0Proxy.address);
        const ethUser0Before = await balance.current(user0);
        const borrowBalanceBefore = await this.cEther.borrowBalanceCurrent.call(this.user0Proxy.address);
  
        const receipt = await this.user0Proxy.execute(FCOMPOUND_ACTIONS, data, {
          from: user0,
          value: amount,
        });
  
        const ethProxyAfter = await balance.current(this.user0Proxy.address);
        const ethUser0After = await balance.current(user0);
        const borrowBalanceAfter = await this.cEther.borrowBalanceCurrent.call(this.user0Proxy.address);
        const borrowBalanceDiff = borrowBalanceBefore.sub(borrowBalanceAfter);
        expect(ethProxyAfter).to.be.bignumber.eq(ethProxyBefore);
        expect(ethUser0After).to.be.bignumber.eq(
          ethUser0Before
            .sub(amount)
            .sub(new BN(receipt.receipt.gasUsed))
        );
        // amount * 0.99 <= borrowBalanceDiff <= amount * 1.01, inaccurateness caused by interest
        expect(borrowBalanceDiff).to.be.bignumber.lte(mulPercent(amount, 101));
        expect(borrowBalanceDiff).to.be.bignumber.gte(mulPercent(amount, 99));
      });

      it('repay ether whole', async function() {
        const amount = ether('5');
        const data = abi.simpleEncode(
          'repayBorrow(address,uint256)',
          this.cEther.address,
          amount
        );
  
        const ethProxyBefore = await balance.current(this.user0Proxy.address);
        const ethUser0Before = await balance.current(user0);
        const borrowBalanceBefore = await this.cEther.borrowBalanceCurrent.call(this.user0Proxy.address);
  
        const receipt = await this.user0Proxy.execute(FCOMPOUND_ACTIONS, data, {
          from: user0,
          value: amount,
        });
  
        const ethProxyAfter = await balance.current(this.user0Proxy.address);
        const ethUser0After = await balance.current(user0);
        const borrowBalanceAfter = await this.cEther.borrowBalanceCurrent.call(this.user0Proxy.address);
        expect(ethProxyAfter).to.be.bignumber.eq(ethProxyBefore);
        // balance might less than expected since debt might be slightly higher than borrowBalanceStored we got
        expect(ethUser0After).to.be.bignumber.lte(
          ethUser0Before
            .sub(borrowBalanceBefore)
            .sub(new BN(receipt.receipt.gasUsed))
        );
        // assume maximum interest is 1% and the balance left after repay should be greater than this
        expect(ethUser0After).to.be.bignumber.gte(
          ethUser0Before
            .sub(mulPercent(borrowBalanceBefore, 101))
            .sub(new BN(receipt.receipt.gasUsed))
        );
        expect(borrowBalanceAfter).to.be.bignumber.eq(ether('0'));
      });
    });

    describe('Repay Token', function() {
      const mintAmount = ether('10');
      const borrowAmount = ether('100');
      beforeEach(async function() {
        // Mint
        await this.cEther.mint({
          from: _,
          value: mintAmount,
        });
        const mintBalance = await this.cEther.balanceOf.call(_);
        await this.cEther.transfer(this.user0Proxy.address, mintBalance, {
          from: _,
        });
        // Enter
        const dataEnter = abi.simpleEncode(
          'enterMarket(address)',
          this.cEther.address
        );
        await this.user0Proxy.execute(FCOMPOUND_ACTIONS, dataEnter, { from: user0 });
        // Borrow
        const dataBorrow = abi.simpleEncode(
          'borrow(address,uint256)',
          this.cToken.address,
          borrowAmount
        );
        await this.user0Proxy.execute(FCOMPOUND_ACTIONS, dataBorrow, {
          from: user0,
        });
        expect(await this.cToken.borrowBalanceStored.call(this.user0Proxy.address)).to.be.bignumber.eq(borrowAmount);
        // Withdraw borrowed token from DSProxy
        const dataWithdraw = abi.simpleEncode(
          'withdraw(address,uint256)',
          this.token.address,
          borrowAmount
        );
        await this.user0Proxy.execute(FCOMPOUND_ACTIONS, dataWithdraw, {
          from: user0,
        });
        expect(await this.token.balanceOf.call(this.user0Proxy.address)).to.be.bignumber.eq(ether('0'));
      });
  
      it('repay token partial', async function() {
        const amount = ether('50');
        const data = abi.simpleEncode(
          'repayBorrow(address,uint256)',
          this.cToken.address,
          amount
        );
        await this.token.approve(this.user0Proxy.address, amount, {from: user0});
  
        const tokenProxyBefore = await this.token.balanceOf.call(this.user0Proxy.address);
        const tokenUser0Before = await this.token.balanceOf.call(user0);
        const ethProxyBefore = await balance.current(this.user0Proxy.address);
        const ethUser0Before = await balance.current(user0);
        const borrowBalanceBefore = await this.cToken.borrowBalanceCurrent.call(this.user0Proxy.address);
  
        const receipt = await this.user0Proxy.execute(FCOMPOUND_ACTIONS, data, {
          from: user0,
          // Send ether with tx when repay token and should be fully send back
          value: ether('1'),
        });
  
        const tokenProxyAfter = await this.token.balanceOf.call(this.user0Proxy.address);
        const tokenUser0After = await this.token.balanceOf.call(user0);
        const ethProxyAfter = await balance.current(this.user0Proxy.address);
        const ethUser0After = await balance.current(user0);
        const borrowBalanceAfter = await this.cToken.borrowBalanceCurrent.call(this.user0Proxy.address);
        const borrowBalanceDiff = borrowBalanceBefore.sub(borrowBalanceAfter);
        expect(ethProxyAfter).to.be.bignumber.eq(ethProxyBefore);
        expect(ethUser0After).to.be.bignumber.eq(
          ethUser0Before.sub(new BN(receipt.receipt.gasUsed))
        );
        expect(tokenProxyAfter).to.be.bignumber.eq(tokenProxyBefore);
        expect(tokenUser0After).to.be.bignumber.eq(
          tokenUser0Before
            .sub(amount)
        );
        // amount * 0.99 <= borrowBalanceDiff <= amount * 1.01, inaccurateness caused by interest
        expect(borrowBalanceDiff).to.be.bignumber.lte(mulPercent(amount, 101));
        expect(borrowBalanceDiff).to.be.bignumber.gte(mulPercent(amount, 99));
      });

      it('repay token whole', async function() {
        const amount = ether('500');
        const data = abi.simpleEncode(
          'repayBorrow(address,uint256)',
          this.cToken.address,
          amount
        );
        await this.token.transfer(user0, amount, {from: providerAddress});
        await this.token.approve(this.user0Proxy.address, amount, {from: user0});
  
        const tokenProxyBefore = await this.token.balanceOf.call(this.user0Proxy.address);
        const tokenUser0Before = await this.token.balanceOf.call(user0);
        const ethProxyBefore = await balance.current(this.user0Proxy.address);
        const ethUser0Before = await balance.current(user0);
        const borrowBalanceBefore = await this.cToken.borrowBalanceCurrent.call(this.user0Proxy.address);
  
        const receipt = await this.user0Proxy.execute(FCOMPOUND_ACTIONS, data, {
          from: user0,
          // Send ether with tx when repay token and should be fully send back
          value: ether('1'),
        });
  
        const tokenProxyAfter = await this.token.balanceOf.call(this.user0Proxy.address);
        const tokenUser0After = await this.token.balanceOf.call(user0);
        const ethProxyAfter = await balance.current(this.user0Proxy.address);
        const ethUser0After = await balance.current(user0);
        const borrowBalanceAfter = await this.cToken.borrowBalanceCurrent.call(this.user0Proxy.address);
        expect(ethProxyAfter).to.be.bignumber.eq(ethProxyBefore);
        expect(ethUser0After).to.be.bignumber.eq(
          ethUser0Before.sub(new BN(receipt.receipt.gasUsed))
        );
        expect(tokenProxyAfter).to.be.bignumber.eq(tokenProxyBefore);
        // balance might less than expected since debt might be slightly higher than borrowBalanceStored we got
        expect(tokenUser0After).to.be.bignumber.lte(
          tokenUser0Before
            .sub(borrowBalanceBefore)
        );
        // assume maximum interest is 1% and the balance left after repay should be greater than this
        expect(tokenUser0After).to.be.bignumber.gte(
          tokenUser0Before
            .sub(mulPercent(borrowBalanceBefore, 101))
        );
        expect(borrowBalanceAfter).to.be.bignumber.eq(ether('0'));
      });

    });
    
  });
});
