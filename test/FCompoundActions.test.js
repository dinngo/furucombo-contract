const {
  balance,
  BN,
  constants,
  ether,
  expectRevert,
  send,
} = require('@openzeppelin/test-helpers');
const abi = require('ethereumjs-abi');

const { expect } = require('chai');

const {
  DAI_TOKEN,
  CDAI,
  CWBTC,
  CETHER,
  ETH_TOKEN,
  MAKER_PROXY_REGISTRY,
  FCOMPOUND_ACTIONS,
  COMPOUND_COMPTROLLER,
} = require('./utils/constants');
const {
  evmRevert,
  evmSnapshot,
  mulPercent,
  tokenProviderUniV2,
} = require('./utils/utils');

const IDSProxyRegistry = artifacts.require('IDSProxyRegistry');
const IDSProxy = artifacts.require('IDSProxy');
const IComptroller = artifacts.require('IComptroller');
const ICEther = artifacts.require('ICEther');
const ICToken = artifacts.require('ICToken');
const IToken = artifacts.require('IERC20');
const ActionsMock = artifacts.require('ActionsMock');

contract('FCompoundActions', function([_, user]) {
  const tokenAddress = DAI_TOKEN;
  const cTokenAddress = CDAI;

  let id;
  let providerAddress;

  before(async function() {
    providerAddress = await tokenProviderUniV2(tokenAddress);

    this.dsRegistry = await IDSProxyRegistry.at(MAKER_PROXY_REGISTRY);

    const dsProxyAddr = await this.dsRegistry.proxies.call(user);
    if (dsProxyAddr == constants.ZERO_ADDRESS)
      await this.dsRegistry.build(user);

    this.userProxy = await IDSProxy.at(
      await this.dsRegistry.proxies.call(user)
    );
    this.token = await IToken.at(tokenAddress);
    this.cToken = await ICToken.at(cTokenAddress);
    this.cEther = await ICEther.at(CETHER);
    this.comptroller = await IComptroller.at(COMPOUND_COMPTROLLER);
    this.actionsMock = await ActionsMock.new();
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
      await this.token.transfer(user, amount, { from: providerAddress });
      await this.token.approve(this.userProxy.address, amount, {
        from: user,
      });
      const tokenProxyBefore = await this.token.balanceOf.call(
        this.userProxy.address
      );
      const tokenUserBefore = await this.token.balanceOf.call(user);

      const receipt = await this.userProxy.execute(FCOMPOUND_ACTIONS, data, {
        from: user,
      });

      const tokenProxyAfter = await this.token.balanceOf.call(
        this.userProxy.address
      );
      const tokenUserAfter = await this.token.balanceOf.call(user);
      expect(tokenProxyAfter).to.be.bignumber.eq(tokenProxyBefore.add(amount));
      expect(tokenUserAfter).to.be.bignumber.eq(tokenUserBefore.sub(amount));
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
      await send.ether(_, this.userProxy.address, amount);
      const ethProxyBefore = await balance.current(this.userProxy.address);
      const ethUserBefore = await balance.current(user);

      const receipt = await this.userProxy.execute(FCOMPOUND_ACTIONS, data, {
        from: user,
      });

      const ethProxyAfter = await balance.current(this.userProxy.address);
      const ethUserAfter = await balance.current(user);
      expect(ethProxyAfter).to.be.bignumber.eq(ethProxyBefore.sub(amount));
      expect(ethUserAfter).to.be.bignumber.eq(
        ethUserBefore.add(amount).sub(new BN(receipt.receipt.gasUsed))
      );
    });

    it('withdraw token', async function() {
      const amount = ether('10');
      const data = abi.simpleEncode(
        'withdraw(address,uint256)',
        this.token.address,
        amount
      );
      await this.token.transfer(this.userProxy.address, amount, {
        from: providerAddress,
      });
      const tokenProxyBefore = await this.token.balanceOf.call(
        this.userProxy.address
      );
      const tokenUserBefore = await this.token.balanceOf.call(user);

      const receipt = await this.userProxy.execute(FCOMPOUND_ACTIONS, data, {
        from: user,
      });

      const tokenProxyAfter = await this.token.balanceOf.call(
        this.userProxy.address
      );
      const tokenUserAfter = await this.token.balanceOf.call(user);
      expect(tokenProxyAfter).to.be.bignumber.eq(tokenProxyBefore.sub(amount));
      expect(tokenUserAfter).to.be.bignumber.eq(tokenUserBefore.add(amount));
    });
  });

  describe('Market', function() {
    it('enter single', async function() {
      const isEnteredBefore = await this.comptroller.checkMembership.call(
        this.userProxy.address,
        this.cToken.address
      );
      expect(isEnteredBefore).to.be.false;
      const data = abi.simpleEncode(
        'enterMarket(address)',
        this.cToken.address
      );
      // User DSProxy enter market
      await this.userProxy.execute(FCOMPOUND_ACTIONS, data, { from: user });
      const isEnteredAfter = await this.comptroller.checkMembership.call(
        this.userProxy.address,
        this.cToken.address
      );
      expect(isEnteredAfter).to.be.true;
    });

    it('enter multiple', async function() {
      const isEnteredBefore0 = await this.comptroller.checkMembership.call(
        this.userProxy.address,
        this.cToken.address
      );
      const isEnteredBefore1 = await this.comptroller.checkMembership.call(
        this.userProxy.address,
        CWBTC
      );
      expect(isEnteredBefore0).to.be.false;
      expect(isEnteredBefore1).to.be.false;
      const data = abi.simpleEncode('enterMarkets(address[])', [
        this.cToken.address,
        CWBTC,
      ]);
      // User DSProxy enter market
      await this.userProxy.execute(FCOMPOUND_ACTIONS, data, { from: user });
      const isEnteredAfter0 = await this.comptroller.checkMembership.call(
        this.userProxy.address,
        this.cToken.address
      );
      const isEnteredAfter1 = await this.comptroller.checkMembership.call(
        this.userProxy.address,
        CWBTC
      );
      expect(isEnteredAfter0).to.be.true;
      expect(isEnteredAfter1).to.be.true;
    });

    it('should revert: non cToken enter', async function() {
      const data = abi.simpleEncode('enterMarket(address)', this.token.address);
      // User DSProxy enter market
      await expectRevert.unspecified(
        // TODO: check how to be specified and remove `.unspecified`
        this.userProxy.execute(FCOMPOUND_ACTIONS, data, { from: user }),
        'FCompoundActions: enter markets failed'
      );
    });

    it('exit', async function() {
      const dataEnter = abi.simpleEncode(
        'enterMarket(address)',
        this.cToken.address
      );
      // User DSProxy enter market
      await this.userProxy.execute(FCOMPOUND_ACTIONS, dataEnter, {
        from: user,
      });
      const isEnteredBefore = await this.comptroller.checkMembership.call(
        this.userProxy.address,
        this.cToken.address
      );
      expect(isEnteredBefore).to.be.true;
      const data = abi.simpleEncode('exitMarket(address)', this.cToken.address);
      // User DSProxy exit market
      await this.userProxy.execute(FCOMPOUND_ACTIONS, data, { from: user });
      const isEnteredAfter = await this.comptroller.checkMembership.call(
        this.userProxy.address,
        this.cToken.address
      );
      expect(isEnteredAfter).to.be.false;
    });

    it('should revert: non cToken exit', async function() {
      const data = abi.simpleEncode('exitMarket(address)', this.token.address);
      // User DSProxy exit market
      await expectRevert.unspecified(
        // TODO: check how to be specified and remove `.unspecified`
        this.userProxy.execute(FCOMPOUND_ACTIONS, data, { from: user }),
        'FCompoundActions: exit markets failed'
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
      await this.cEther.transfer(this.userProxy.address, mintBalance, {
        from: _,
      });
      // Enter
      const data = abi.simpleEncode(
        'enterMarket(address)',
        this.cEther.address
      );
      await this.userProxy.execute(FCOMPOUND_ACTIONS, data, { from: user });
    });

    it('borrow ether', async function() {
      const borrowAddress = this.cEther.address;
      const amount = ether('1');
      const data = abi.simpleEncode(
        'borrow(address,uint256)',
        borrowAddress,
        amount
      );

      const ethProxyBefore = await balance.current(this.userProxy.address);
      const ethUserBefore = await balance.current(user);

      const receipt = await this.userProxy.execute(FCOMPOUND_ACTIONS, data, {
        from: user,
      });

      const ethProxyAfter = await balance.current(this.userProxy.address);
      const ethUserAfter = await balance.current(user);
      expect(ethProxyAfter).to.be.bignumber.eq(ethProxyBefore.add(amount));
      expect(ethUserAfter).to.be.bignumber.eq(
        ethUserBefore.sub(new BN(receipt.receipt.gasUsed))
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
        this.userProxy.address
      );
      const tokenUserBefore = await this.token.balanceOf.call(user);

      const receipt = await this.userProxy.execute(FCOMPOUND_ACTIONS, data, {
        from: user,
      });

      const tokenProxyAfter = await this.token.balanceOf.call(
        this.userProxy.address
      );
      const tokenUserAfter = await this.token.balanceOf.call(user);
      expect(tokenProxyAfter).to.be.bignumber.eq(tokenProxyBefore.add(amount));
      expect(tokenUserAfter).to.be.bignumber.eq(tokenUserBefore);
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
        await this.cEther.transfer(this.userProxy.address, mintBalance, {
          from: _,
        });
        // Enter
        const dataEnter = abi.simpleEncode(
          'enterMarket(address)',
          this.cEther.address
        );
        await this.userProxy.execute(FCOMPOUND_ACTIONS, dataEnter, {
          from: user,
        });
        // Borrow
        const dataBorrow = abi.simpleEncode(
          'borrow(address,uint256)',
          this.cEther.address,
          borrowAmount
        );
        await this.userProxy.execute(FCOMPOUND_ACTIONS, dataBorrow, {
          from: user,
        });
        expect(
          await this.cEther.borrowBalanceStored.call(this.userProxy.address)
        ).to.be.bignumber.eq(borrowAmount);
      });

      it('repay ether partial', async function() {
        const amount = ether('0.5');
        const data = abi.simpleEncode(
          'repayBorrow(address,uint256)',
          this.cEther.address,
          amount
        );

        const ethProxyBefore = await balance.current(this.userProxy.address);
        const ethUserBefore = await balance.current(user);
        const borrowBalanceBefore = await this.cEther.borrowBalanceCurrent.call(
          this.userProxy.address
        );

        const receipt = await this.userProxy.execute(FCOMPOUND_ACTIONS, data, {
          from: user,
          value: amount,
        });

        const ethProxyAfter = await balance.current(this.userProxy.address);
        const ethUserAfter = await balance.current(user);
        const borrowBalanceAfter = await this.cEther.borrowBalanceCurrent.call(
          this.userProxy.address
        );
        const borrowBalanceDiff = borrowBalanceBefore.sub(borrowBalanceAfter);
        expect(ethProxyAfter).to.be.bignumber.eq(ethProxyBefore);
        expect(ethUserAfter).to.be.bignumber.eq(
          ethUserBefore.sub(amount).sub(new BN(receipt.receipt.gasUsed))
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

        const ethProxyBefore = await balance.current(this.userProxy.address);
        const ethUserBefore = await balance.current(user);
        const borrowBalanceBefore = await this.cEther.borrowBalanceCurrent.call(
          this.userProxy.address
        );

        const receipt = await this.userProxy.execute(FCOMPOUND_ACTIONS, data, {
          from: user,
          value: amount,
        });

        const ethProxyAfter = await balance.current(this.userProxy.address);
        const ethUserAfter = await balance.current(user);
        const borrowBalanceAfter = await this.cEther.borrowBalanceCurrent.call(
          this.userProxy.address
        );
        expect(ethProxyAfter).to.be.bignumber.eq(ethProxyBefore);
        // balance might less than expected since debt might be slightly higher than borrowBalanceStored we got
        expect(ethUserAfter).to.be.bignumber.lte(
          ethUserBefore
            .sub(borrowBalanceBefore)
            .sub(new BN(receipt.receipt.gasUsed))
        );
        // assume maximum interest is 1% and the balance left after repay should be greater than this
        expect(ethUserAfter).to.be.bignumber.gte(
          ethUserBefore
            .sub(mulPercent(borrowBalanceBefore, 101))
            .sub(new BN(receipt.receipt.gasUsed))
        );
        expect(borrowBalanceAfter).to.be.bignumber.zero;
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
        await this.cEther.transfer(this.userProxy.address, mintBalance, {
          from: _,
        });
        // Enter
        const dataEnter = abi.simpleEncode(
          'enterMarket(address)',
          this.cEther.address
        );
        await this.userProxy.execute(FCOMPOUND_ACTIONS, dataEnter, {
          from: user,
        });
        // Borrow
        const dataBorrow = abi.simpleEncode(
          'borrow(address,uint256)',
          this.cToken.address,
          borrowAmount
        );
        await this.userProxy.execute(FCOMPOUND_ACTIONS, dataBorrow, {
          from: user,
        });
        expect(
          await this.cToken.borrowBalanceStored.call(this.userProxy.address)
        ).to.be.bignumber.eq(borrowAmount);
        // Withdraw borrowed token from DSProxy
        const dataWithdraw = abi.simpleEncode(
          'withdraw(address,uint256)',
          this.token.address,
          borrowAmount
        );
        await this.userProxy.execute(FCOMPOUND_ACTIONS, dataWithdraw, {
          from: user,
        });
        expect(
          await this.token.balanceOf.call(this.userProxy.address)
        ).to.be.bignumber.zero;
      });

      it('repay token partial', async function() {
        const amount = ether('50');
        const data = abi.simpleEncode(
          'repayBorrow(address,uint256)',
          this.cToken.address,
          amount
        );
        await this.token.approve(this.userProxy.address, amount, {
          from: user,
        });

        const tokenProxyBefore = await this.token.balanceOf.call(
          this.userProxy.address
        );
        const tokenUserBefore = await this.token.balanceOf.call(user);
        const ethProxyBefore = await balance.current(this.userProxy.address);
        const ethUserBefore = await balance.current(user);
        const borrowBalanceBefore = await this.cToken.borrowBalanceCurrent.call(
          this.userProxy.address
        );

        const receipt = await this.userProxy.execute(FCOMPOUND_ACTIONS, data, {
          from: user,
          // Send ether with tx when repay token and should be fully send back
          value: ether('1'),
        });

        const tokenProxyAfter = await this.token.balanceOf.call(
          this.userProxy.address
        );
        const tokenUserAfter = await this.token.balanceOf.call(user);
        const ethProxyAfter = await balance.current(this.userProxy.address);
        const ethUserAfter = await balance.current(user);
        const borrowBalanceAfter = await this.cToken.borrowBalanceCurrent.call(
          this.userProxy.address
        );
        const borrowBalanceDiff = borrowBalanceBefore.sub(borrowBalanceAfter);
        expect(ethProxyAfter).to.be.bignumber.eq(ethProxyBefore);
        expect(ethUserAfter).to.be.bignumber.eq(
          ethUserBefore.sub(new BN(receipt.receipt.gasUsed))
        );
        expect(tokenProxyAfter).to.be.bignumber.eq(tokenProxyBefore);
        expect(tokenUserAfter).to.be.bignumber.eq(tokenUserBefore.sub(amount));
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
        await this.token.transfer(user, amount, { from: providerAddress });
        await this.token.approve(this.userProxy.address, amount, {
          from: user,
        });

        const tokenProxyBefore = await this.token.balanceOf.call(
          this.userProxy.address
        );
        const tokenUserBefore = await this.token.balanceOf.call(user);
        const ethProxyBefore = await balance.current(this.userProxy.address);
        const ethUserBefore = await balance.current(user);
        const borrowBalanceBefore = await this.cToken.borrowBalanceCurrent.call(
          this.userProxy.address
        );

        const receipt = await this.userProxy.execute(FCOMPOUND_ACTIONS, data, {
          from: user,
          // Send ether with tx when repay token and should be fully send back
          value: ether('1'),
        });

        const tokenProxyAfter = await this.token.balanceOf.call(
          this.userProxy.address
        );
        const tokenUserAfter = await this.token.balanceOf.call(user);
        const ethProxyAfter = await balance.current(this.userProxy.address);
        const ethUserAfter = await balance.current(user);
        const borrowBalanceAfter = await this.cToken.borrowBalanceCurrent.call(
          this.userProxy.address
        );
        expect(ethProxyAfter).to.be.bignumber.eq(ethProxyBefore);
        expect(ethUserAfter).to.be.bignumber.eq(
          ethUserBefore.sub(new BN(receipt.receipt.gasUsed))
        );
        expect(tokenProxyAfter).to.be.bignumber.eq(tokenProxyBefore);
        // balance might less than expected since debt might be slightly higher than borrowBalanceStored we got
        expect(tokenUserAfter).to.be.bignumber.lte(
          tokenUserBefore.sub(borrowBalanceBefore)
        );
        // assume maximum interest is 1% and the balance left after repay should be greater than this
        expect(tokenUserAfter).to.be.bignumber.gte(
          tokenUserBefore.sub(mulPercent(borrowBalanceBefore, 101))
        );
        expect(borrowBalanceAfter).to.be.bignumber.zero;
      });

      it('repay token whole - dsproxy pre approve partial token', async function() {
        // Make DSProxy to pre-approve partial token that is going to be repaid
        const preApproveAmount = mulPercent(borrowAmount, 90);
        const dataPreApprove = abi.simpleEncode(
          'approveToken(address,address,uint256)',
          this.token.address,
          this.cToken.address,
          preApproveAmount
        );
        await this.userProxy.execute(this.actionsMock.address, dataPreApprove, {
          from: user,
        });
        expect(
          await this.token.allowance(
            this.userProxy.address,
            this.cToken.address
          )
        ).to.be.bignumber.eq(preApproveAmount);
        // Prepare repay data
        const amount = ether('500');
        const data = abi.simpleEncode(
          'repayBorrow(address,uint256)',
          this.cToken.address,
          amount
        );

        await this.token.transfer(user, amount, { from: providerAddress });
        await this.token.approve(this.userProxy.address, amount, {
          from: user,
        });

        const tokenProxyBefore = await this.token.balanceOf.call(
          this.userProxy.address
        );
        const tokenUserBefore = await this.token.balanceOf.call(user);
        const ethProxyBefore = await balance.current(this.userProxy.address);
        const ethUserBefore = await balance.current(user);
        const borrowBalanceBefore = await this.cToken.borrowBalanceCurrent.call(
          this.userProxy.address
        );

        const receipt = await this.userProxy.execute(FCOMPOUND_ACTIONS, data, {
          from: user,
          // Send ether with tx when repay token and should be fully send back
          value: ether('1'),
        });

        const tokenProxyAfter = await this.token.balanceOf.call(
          this.userProxy.address
        );
        const tokenUserAfter = await this.token.balanceOf.call(user);
        const ethProxyAfter = await balance.current(this.userProxy.address);
        const ethUserAfter = await balance.current(user);
        const borrowBalanceAfter = await this.cToken.borrowBalanceCurrent.call(
          this.userProxy.address
        );
        expect(ethProxyAfter).to.be.bignumber.eq(ethProxyBefore);
        expect(ethUserAfter).to.be.bignumber.eq(
          ethUserBefore.sub(new BN(receipt.receipt.gasUsed))
        );
        expect(tokenProxyAfter).to.be.bignumber.eq(tokenProxyBefore);
        // balance might less than expected since debt might be slightly higher than borrowBalanceStored we got
        expect(tokenUserAfter).to.be.bignumber.lte(
          tokenUserBefore.sub(borrowBalanceBefore)
        );
        // assume maximum interest is 1% and the balance left after repay should be greater than this
        expect(tokenUserAfter).to.be.bignumber.gte(
          tokenUserBefore.sub(mulPercent(borrowBalanceBefore, 101))
        );
        expect(borrowBalanceAfter).to.be.bignumber.zero;
        // verify no token allowance left in this case
        expect(
          await this.token.allowance(
            this.userProxy.address,
            this.cToken.address
          )
        ).to.be.bignumber.zero;
      });
    });
  });
});
