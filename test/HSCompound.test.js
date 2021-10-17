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
  ETH_TOKEN,
  COMP_TOKEN,
  DAI_TOKEN,
  DAI_PROVIDER,
  CDAI,
  CWBTC,
  CETHER,
  MAKER_PROXY_REGISTRY,
  CREATE2_FACTORY,
  FCOMPOUND_ACTIONS_SALT,
  FCOMPOUND_ACTIONS,
  COMPOUND_COMPTROLLER,
} = require('./utils/constants');
const {
  evmRevert,
  evmSnapshot,
  profileGas,
  mulPercent,
  cUnit,
  getHandlerReturn,
} = require('./utils/utils');
const { getFCompoundActionsBytecodeBySolc } = require('./utils/getBytecode');

const HSCompound = artifacts.require('HSCompound');
const Registry = artifacts.require('Registry');
const Proxy = artifacts.require('ProxyMock');
const DSGuardFactory = artifacts.require('DSGuardFactory');
const IDSProxyRegistry = artifacts.require('IDSProxyRegistry');
const IDSProxy = artifacts.require('IDSProxy');
const ISingletonFactory = artifacts.require('ISingletonFactory');
const IComptroller = artifacts.require('IComptroller');
const ICEther = artifacts.require('ICEther');
const ICToken = artifacts.require('ICToken');
const IToken = artifacts.require('IERC20');

contract('Compound x Smart Wallet', function([_, user, someone]) {
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

    this.dsRegistry = await IDSProxyRegistry.at(MAKER_PROXY_REGISTRY);
    // User build DSProxy
    const dsProxyAddr = await this.dsRegistry.proxies.call(user);
    if (dsProxyAddr == constants.ZERO_ADDRESS)
      await this.dsRegistry.build(user);

    this.userProxy = await IDSProxy.at(
      await this.dsRegistry.proxies.call(user)
    );
    this.factory = await DSGuardFactory.new();
    // User new DSGuard and set as authority to its DSProxy
    await this.factory.newGuard(
      true,
      this.proxy.address,
      this.userProxy.address,
      { from: user }
    );
    const guardAddr = await this.factory.guards(user);
    await this.userProxy.setAuthority(guardAddr, { from: user });
    this.token = await IToken.at(tokenAddress);
    this.cToken = await ICToken.at(cTokenAddress);
    this.cEther = await ICEther.at(CETHER);
    this.comp = await IToken.at(COMP_TOKEN);
    this.comptroller = await IComptroller.at(COMPOUND_COMPTROLLER);

    await hre.network.provider.request({
      method: 'hardhat_impersonateAccount',
      params: [DAI_PROVIDER],
    });
  });

  beforeEach(async function() {
    id = await evmSnapshot();
  });

  afterEach(async function() {
    await evmRevert(id);
  });

  describe('Deposit', function() {
    it('ether', async function() {
      const amount = ether('1');
      const to = this.hsCompound.address;
      const data = abi.simpleEncode(
        'deposit(address,address,uint256)',
        this.userProxy.address,
        ETH_TOKEN,
        amount
      );
      const ethUserBefore = await balance.current(user);

      const receipt = await this.proxy.execMock(to, data, {
        from: user,
        value: amount,
      });
      const ethUserProxyAfter = await balance.current(this.userProxy.address);
      const ethProxyAfter = await balance.current(this.proxy.address);
      const ethUserAfter = await balance.current(user);
      expect(ethUserProxyAfter).to.be.bignumber.eq(amount);
      expect(ethProxyAfter).to.be.zero;
      expect(ethUserAfter).to.be.bignumber.eq(
        ethUserBefore.sub(amount).sub(new BN(receipt.receipt.gasUsed))
      );
      profileGas(receipt);
    });

    it('token', async function() {
      const amount = ether('50');
      const to = this.hsCompound.address;
      const data = abi.simpleEncode(
        'deposit(address,address,uint256)',
        this.userProxy.address,
        this.token.address,
        amount
      );
      // Inject token to Proxy
      await this.token.transfer(this.proxy.address, amount, {
        from: providerAddress,
      });
      await this.proxy.updateTokenMock(this.token.address);

      const receipt = await this.proxy.execMock(to, data, {
        from: user,
        value: ether('0.1'),
      });
      const tokenUserProxyAfter = await this.token.balanceOf.call(
        this.userProxy.address
      );
      const tokenProxyAfter = await this.token.balanceOf.call(
        this.proxy.address
      );
      const tokenUserAfter = await this.token.balanceOf.call(user);
      expect(tokenUserProxyAfter).to.be.bignumber.eq(amount);
      expect(tokenProxyAfter).to.be.zero;
      expect(tokenUserAfter).to.be.zero;
      profileGas(receipt);
    });

    it('should revert: not dsproxy owner', async function() {
      const amount = ether('50');
      const to = this.hsCompound.address;
      const data = abi.simpleEncode(
        'deposit(address,address,uint256)',
        this.userProxy.address,
        this.token.address,
        amount
      );
      // Inject token to Proxy
      await this.token.transfer(this.proxy.address, amount, {
        from: providerAddress,
      });
      await this.proxy.updateTokenMock(this.token.address);

      await expectRevert(
        this.proxy.execMock(to, data, {
          from: someone,
        }),
        'HSCompound_General: Not owner of the DSProxy'
      );
    });
  });

  describe('Withdraw', function() {
    it('ether', async function() {
      const amount = ether('5');
      const to = this.hsCompound.address;
      const data = abi.simpleEncode(
        'withdraw(address,address,uint256)',
        this.userProxy.address,
        ETH_TOKEN,
        amount
      );
      // Transfer ether to DSProxy for withdrawal
      await send.ether(_, this.userProxy.address, amount);

      const ethUserBefore = await balance.current(user);
      const receipt = await this.proxy.execMock(to, data, {
        from: user,
        value: ether('0.1'),
      });

      const ethUserProxyAfter = await balance.current(this.userProxy.address);
      const ethProxyAfter = await balance.current(this.proxy.address);
      const ethUserAfter = await balance.current(user);

      expect(ethUserProxyAfter).to.be.zero;
      expect(ethProxyAfter).to.be.zero;
      expect(ethUserAfter).to.be.bignumber.eq(
        ethUserBefore.add(amount).sub(new BN(receipt.receipt.gasUsed))
      );
      profileGas(receipt);
    });

    it('token', async function() {
      const amount = ether('50');
      const to = this.hsCompound.address;
      const data = abi.simpleEncode(
        'withdraw(address,address,uint256)',
        this.userProxy.address,
        this.token.address,
        amount
      );
      // Transfer token to DSProxy for withdrawal
      await this.token.transfer(this.userProxy.address, amount, {
        from: providerAddress,
      });

      const receipt = await this.proxy.execMock(to, data, {
        from: user,
        value: ether('0.1'),
      });
      const tokenUserProxyAfter = await this.token.balanceOf.call(
        this.userProxy.address
      );
      const tokenProxyAfter = await this.token.balanceOf.call(
        this.proxy.address
      );
      const tokenUserAfter = await this.token.balanceOf.call(user);
      expect(tokenUserProxyAfter).to.be.zero;
      expect(tokenProxyAfter).to.be.zero;
      expect(tokenUserAfter).to.be.bignumber.eq(amount);
      profileGas(receipt);
    });

    it('should revert: not dsproxy owner', async function() {
      const amount = ether('50');
      const to = this.hsCompound.address;
      const data = abi.simpleEncode(
        'withdraw(address,address,uint256)',
        this.userProxy.address,
        this.token.address,
        amount
      );
      // Transfer token to DSProxy for withdrawal
      await this.token.transfer(this.userProxy.address, amount, {
        from: providerAddress,
      });

      await expectRevert(
        this.proxy.execMock(to, data, {
          from: someone,
        }),
        'HSCompound_General: Not owner of the DSProxy'
      );
    });
  });

  describe('Market', function() {
    describe('Enter Single', function() {
      it('normal', async function() {
        const tokenToEnter = this.cToken.address;
        const to = this.hsCompound.address;
        const data = abi.simpleEncode(
          'enterMarket(address,address)',
          this.userProxy.address,
          tokenToEnter
        );
        // Check token has not entered market before
        expect(
          await this.comptroller.checkMembership.call(
            this.userProxy.address,
            tokenToEnter
          )
        ).to.be.false;

        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: ether('0.1'),
        });
        expect(
          await this.comptroller.checkMembership.call(
            this.userProxy.address,
            tokenToEnter
          )
        ).to.be.true;
        profileGas(receipt);
      });

      it('should revert: not dsproxy owner', async function() {
        const tokenToEnter = this.cToken.address;
        const to = this.hsCompound.address;
        const data = abi.simpleEncode(
          'enterMarket(address,address)',
          this.userProxy.address,
          tokenToEnter
        );
        // Check token has not entered market before
        expect(
          await this.comptroller.checkMembership.call(
            this.userProxy.address,
            tokenToEnter
          )
        ).to.be.false;

        await expectRevert(
          this.proxy.execMock(to, data, {
            from: someone,
          }),
          'HSCompound_General: Not owner of the DSProxy'
        );
      });
    });

    describe('Enter Multiple', function() {
      it('normal', async function() {
        const tokensToEnter = [this.cToken.address, CWBTC];
        const to = this.hsCompound.address;
        const data = abi.simpleEncode(
          'enterMarkets(address,address[])',
          this.userProxy.address,
          tokensToEnter
        );
        // Check tokens has not entered market before
        expect(
          await this.comptroller.checkMembership.call(
            this.userProxy.address,
            tokensToEnter[0]
          )
        ).to.be.false;
        expect(
          await this.comptroller.checkMembership.call(
            this.userProxy.address,
            tokensToEnter[1]
          )
        ).to.be.false;

        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: ether('0.1'),
        });
        expect(
          await this.comptroller.checkMembership.call(
            this.userProxy.address,
            tokensToEnter[0]
          )
        ).to.be.true;
        expect(
          await this.comptroller.checkMembership.call(
            this.userProxy.address,
            tokensToEnter[1]
          )
        ).to.be.true;
        profileGas(receipt);
      });

      it('should revert: not dsproxy owner', async function() {
        const tokensToEnter = [this.cToken.address, CWBTC];
        const to = this.hsCompound.address;
        const data = abi.simpleEncode(
          'enterMarkets(address,address[])',
          this.userProxy.address,
          tokensToEnter
        );
        // Check tokens has not entered market before
        expect(
          await this.comptroller.checkMembership.call(
            this.userProxy.address,
            tokensToEnter[0]
          )
        ).to.be.false;
        expect(
          await this.comptroller.checkMembership.call(
            this.userProxy.address,
            tokensToEnter[1]
          )
        ).to.be.false;

        await expectRevert(
          this.proxy.execMock(to, data, {
            from: someone,
          }),
          'HSCompound_General: Not owner of the DSProxy'
        );
      });
    });

    describe('Exit', function() {
      it('normal', async function() {
        const tokenToExit = this.cToken.address;
        const to = this.hsCompound.address;
        // Enter market first
        const dataEnter = abi.simpleEncode(
          'enterMarket(address,address)',
          this.userProxy.address,
          tokenToExit
        );
        await this.proxy.execMock(to, dataEnter, {
          from: user,
          value: ether('0.1'),
        });
        expect(
          await this.comptroller.checkMembership.call(
            this.userProxy.address,
            tokenToExit
          )
        ).to.be.true;
        // Prepare exit data
        const data = abi.simpleEncode(
          'exitMarket(address,address)',
          this.userProxy.address,
          tokenToExit
        );
        // Exit
        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: ether('0.1'),
        });
        expect(
          await this.comptroller.checkMembership.call(
            this.userProxy.address,
            tokenToExit
          )
        ).to.be.false;
        profileGas(receipt);
      });

      it('should revert: not dsproxy owner', async function() {
        const tokenToExit = this.cToken.address;
        const to = this.hsCompound.address;
        // Enter market first
        const dataEnter = abi.simpleEncode(
          'enterMarket(address,address)',
          this.userProxy.address,
          tokenToExit
        );
        await this.proxy.execMock(to, dataEnter, {
          from: user,
          value: ether('0.1'),
        });
        expect(
          await this.comptroller.checkMembership.call(
            this.userProxy.address,
            tokenToExit
          )
        ).to.be.true;
        // Prepare exit data
        const data = abi.simpleEncode(
          'exitMarket(address,address)',
          this.userProxy.address,
          tokenToExit
        );
        // Exit
        await expectRevert(
          this.proxy.execMock(to, data, {
            from: someone,
          }),
          'HSCompound_General: Not owner of the DSProxy'
        );
      });
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
      await this.cEther.transfer(user, mintBalance, {
        from: _,
      });
    });

    describe('Ether', function() {
      // We only test `enterMarket = true` here since collateral and debt are both cEther in this case,
      // and leave the `enterMarket = false` test in `borrow token` section
      it('normal', async function() {
        const cAmountIn = cUnit('300');
        const borrowAmount = ether('1');
        const to = this.hsCompound.address;
        const data = abi.simpleEncode(
          'borrow(address,address,address,uint256,uint256,bool)',
          this.userProxy.address,
          this.cEther.address,
          this.cEther.address,
          cAmountIn,
          borrowAmount,
          true
        );
        // Inject collateral cToken to Proxy
        await this.cEther.transfer(this.proxy.address, cAmountIn, {
          from: user,
        });
        await this.proxy.updateTokenMock(this.cEther.address);
        const ethUserBefore = await balance.current(user);
        // Check collateral has not entered market before
        expect(
          await this.comptroller.checkMembership.call(
            this.userProxy.address,
            this.cEther.address
          )
        ).to.be.false;
        // Execute borrow
        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: ether('0.1'),
        });
        const collateralUserProxyAfter = await this.cEther.balanceOf.call(
          this.userProxy.address
        );
        const ethUserProxyAfter = await balance.current(this.userProxy.address);
        const ethUserAfter = await balance.current(user);
        const ethProxyAfter = await balance.current(this.proxy.address);
        const borrowBalanceAfter = await this.cEther.borrowBalanceStored.call(
          this.userProxy.address
        );
        expect(
          await this.comptroller.checkMembership.call(
            this.userProxy.address,
            this.cEther.address
          )
        ).to.be.true;
        expect(collateralUserProxyAfter).to.be.bignumber.eq(cAmountIn);
        expect(ethUserProxyAfter).to.be.zero;
        expect(ethProxyAfter).to.be.zero;
        expect(ethUserAfter).to.be.bignumber.eq(
          ethUserBefore.add(borrowAmount).sub(new BN(receipt.receipt.gasUsed))
        );
        expect(borrowBalanceAfter).to.be.bignumber.eq(borrowAmount);
        profileGas(receipt);
      });

      it('only input (deposit collateral)', async function() {
        const cAmountIn = cUnit('300');
        const borrowAmount = ether('0');
        const to = this.hsCompound.address;
        const data = abi.simpleEncode(
          'borrow(address,address,address,uint256,uint256,bool)',
          this.userProxy.address,
          this.cEther.address,
          this.cEther.address,
          cAmountIn,
          borrowAmount,
          true
        );
        // Inject collateral cToken to Proxy
        await this.cEther.transfer(this.proxy.address, cAmountIn, {
          from: user,
        });
        await this.proxy.updateTokenMock(this.cEther.address);
        const ethUserBefore = await balance.current(user);
        // Check collateral has not entered market before
        expect(
          await this.comptroller.checkMembership.call(
            this.userProxy.address,
            this.cEther.address
          )
        ).to.be.false;
        // Execute borrow
        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: ether('0.1'),
        });
        const collateralUserProxyAfter = await this.cEther.balanceOf.call(
          this.userProxy.address
        );
        const ethUserProxyAfter = await balance.current(this.userProxy.address);
        const ethUserAfter = await balance.current(user);
        const ethProxyAfter = await balance.current(this.proxy.address);
        const borrowBalanceAfter = await this.cEther.borrowBalanceStored.call(
          this.userProxy.address
        );
        expect(
          await this.comptroller.checkMembership.call(
            this.userProxy.address,
            this.cEther.address
          )
        ).to.be.true;
        expect(collateralUserProxyAfter).to.be.bignumber.eq(cAmountIn);
        expect(ethUserProxyAfter).to.be.zero;
        expect(ethProxyAfter).to.be.zero;
        expect(ethUserAfter).to.be.bignumber.eq(
          ethUserBefore.sub(new BN(receipt.receipt.gasUsed))
        );
        expect(borrowBalanceAfter).to.be.zero;
        profileGas(receipt);
      });

      it('only output (borrow without new collateral)', async function() {
        const collateralAmount = cUnit('300');
        // Directly transfer collateral to DSProxy first
        await this.cEther.transfer(this.userProxy.address, collateralAmount, {
          from: user,
        });
        // And enter market for collateral
        const dataEnter = abi.simpleEncode(
          'enterMarket(address)',
          this.cEther.address
        );
        await this.userProxy.execute(FCOMPOUND_ACTIONS, dataEnter, {
          from: user,
        });
        // Check collateral amount already in dsproxy, has entered market, 0 borrow
        expect(
          await this.cEther.balanceOf.call(this.userProxy.address)
        ).to.be.bignumber.eq(collateralAmount);
        expect(
          await this.comptroller.checkMembership.call(
            this.userProxy.address,
            this.cEther.address
          )
        ).to.be.true;
        expect(
          await this.cEther.borrowBalanceStored.call(this.userProxy.address)
        ).to.be.zero;

        const cAmountIn = cUnit('0');
        const borrowAmount = ether('1');
        const to = this.hsCompound.address;
        const data = abi.simpleEncode(
          'borrow(address,address,address,uint256,uint256,bool)',
          this.userProxy.address,
          this.cEther.address,
          this.cEther.address,
          cAmountIn,
          borrowAmount,
          true
        );
        const ethUserBefore = await balance.current(user);
        // Execute borrow
        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: ether('0.1'), // check handler function is payable
        });
        const collateralUserProxyAfter = await this.cEther.balanceOf.call(
          this.userProxy.address
        );
        const ethUserProxyAfter = await balance.current(this.userProxy.address);
        const ethUserAfter = await balance.current(user);
        const ethProxyAfter = await balance.current(this.proxy.address);
        const borrowBalanceAfter = await this.cEther.borrowBalanceStored.call(
          this.userProxy.address
        );
        expect(collateralUserProxyAfter).to.be.bignumber.eq(collateralAmount);
        expect(ethUserProxyAfter).to.be.zero;
        expect(ethProxyAfter).to.be.zero;
        expect(ethUserAfter).to.be.bignumber.eq(
          ethUserBefore.add(borrowAmount).sub(new BN(receipt.receipt.gasUsed))
        );
        expect(borrowBalanceAfter).to.be.bignumber.eq(borrowAmount);
        profileGas(receipt);
      });
    });

    describe('Token', function() {
      it('borrow token with enter market', async function() {
        const cAmountIn = cUnit('300'); // cEther
        const borrowAmount = ether('10'); // token
        const to = this.hsCompound.address;
        const data = abi.simpleEncode(
          'borrow(address,address,address,uint256,uint256,bool)',
          this.userProxy.address,
          this.cEther.address,
          this.cToken.address,
          cAmountIn,
          borrowAmount,
          true
        );
        // Inject collateral cToken to Proxy
        await this.cEther.transfer(this.proxy.address, cAmountIn, {
          from: user,
        });
        await this.proxy.updateTokenMock(this.cEther.address);
        const ethUserBefore = await balance.current(user);
        // Check collateral has not entered market before
        expect(
          await this.comptroller.checkMembership.call(
            this.userProxy.address,
            this.cEther.address
          )
        ).to.be.false;
        // Execute borrow
        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: ether('0.1'), // check function is payable
        });
        const collateralUserProxyAfter = await this.cEther.balanceOf.call(
          this.userProxy.address
        );
        const tokenUserProxyAfter = await this.token.balanceOf.call(
          this.userProxy.address
        );
        const tokenUserAfter = await this.token.balanceOf.call(user);
        const tokenProxyAfter = await this.token.balanceOf.call(
          this.proxy.address
        );
        const ethUserAfter = await balance.current(user);
        const borrowBalanceAfter = await this.cToken.borrowBalanceStored.call(
          this.userProxy.address
        );
        expect(collateralUserProxyAfter).to.be.bignumber.eq(cAmountIn);
        expect(tokenUserProxyAfter).to.be.zero;
        expect(tokenProxyAfter).to.be.zero;
        expect(tokenUserAfter).to.be.bignumber.eq(borrowAmount);
        expect(ethUserAfter).to.be.bignumber.eq(
          ethUserBefore.sub(new BN(receipt.receipt.gasUsed))
        );
        expect(borrowBalanceAfter).to.be.bignumber.eq(borrowAmount);
        profileGas(receipt);
      });

      it('should revert: borrow token without enter market', async function() {
        const cAmountIn = cUnit('300'); // cEther
        const borrowAmount = ether('10'); // token
        const to = this.hsCompound.address;
        const data = abi.simpleEncode(
          'borrow(address,address,address,uint256,uint256,bool)',
          this.userProxy.address,
          this.cEther.address,
          this.cToken.address,
          cAmountIn,
          borrowAmount,
          false
        );
        // Inject collateral cToken to Proxy
        await this.cEther.transfer(this.proxy.address, cAmountIn, {
          from: user,
        });
        await this.proxy.updateTokenMock(this.cEther.address);
        // Check collateral has not entered market before
        expect(
          await this.comptroller.checkMembership.call(
            this.userProxy.address,
            this.cEther.address
          )
        ).to.be.false;
        // Expect to be reverted since collateral not enter market
        await expectRevert(
          this.proxy.execMock(to, data, {
            from: user,
          }),
          'HSCompound_borrow: Unspecified'
        );
      });

      it('should revert: not dsproxy owner', async function() {
        const cAmountIn = cUnit('300'); // cEther
        const borrowAmount = ether('10'); // token
        const to = this.hsCompound.address;
        const data = abi.simpleEncode(
          'borrow(address,address,address,uint256,uint256,bool)',
          this.userProxy.address,
          this.cEther.address,
          this.cToken.address,
          cAmountIn,
          borrowAmount,
          true
        );
        // Inject collateral cToken to Proxy
        await this.cEther.transfer(this.proxy.address, cAmountIn, {
          from: user,
        });
        await this.proxy.updateTokenMock(this.cEther.address);
        // Check collateral has not entered market before
        expect(
          await this.comptroller.checkMembership.call(
            this.userProxy.address,
            this.cEther.address
          )
        ).to.be.false;
        // Expect to be reverted since collateral not enter market
        await expectRevert(
          this.proxy.execMock(to, data, {
            from: someone,
          }),
          'HSCompound_General: Not owner of the DSProxy'
        );
      });
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

      it('repay whole', async function() {
        const repayAmount = ether('5'); // ether
        const cWithdrawAmount = cUnit('450'); // cEther
        const to = this.hsCompound.address;
        const data = abi.simpleEncode(
          'repayBorrow(address,address,address,uint256,uint256)',
          this.userProxy.address,
          this.cEther.address,
          this.cEther.address,
          repayAmount,
          cWithdrawAmount
        );
        const ethUserBefore = await balance.current(user);
        const borrowBalanceBefore = await this.cEther.borrowBalanceCurrent.call(
          this.userProxy.address
        );

        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: repayAmount,
        });

        const ethProxyAfter = await balance.current(this.proxy.address);
        const ethUserProxyAfter = await balance.current(this.userProxy.address);
        const ethUserAfter = await balance.current(user);
        const cTokenUserAfter = await this.cEther.balanceOf.call(user);
        const borrowBalanceAfter = await this.cEther.borrowBalanceCurrent.call(
          this.userProxy.address
        );
        expect(ethUserProxyAfter).to.be.zero;
        expect(ethProxyAfter).to.be.zero;
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
        expect(cTokenUserAfter).to.be.bignumber.eq(cWithdrawAmount);
        expect(borrowBalanceAfter).to.be.zero;
        profileGas(receipt);
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
        ).to.be.zero;
      });

      it('repay whole', async function() {
        const repayAmount = ether('200'); // token
        const cWithdrawAmount = cUnit('450'); // cEther
        const to = this.hsCompound.address;
        const data = abi.simpleEncode(
          'repayBorrow(address,address,address,uint256,uint256)',
          this.userProxy.address,
          this.cToken.address,
          this.cEther.address,
          repayAmount,
          cWithdrawAmount
        );
        await this.token.transfer(this.proxy.address, repayAmount, {
          from: providerAddress,
        });
        await this.proxy.updateTokenMock(this.token.address);

        const tokenUserBefore = await this.token.balanceOf.call(user);
        const ethUserBefore = await balance.current(user);
        const borrowBalanceBefore = await this.cToken.borrowBalanceCurrent.call(
          this.userProxy.address
        );

        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: ether('0.1'),
        });

        const tokenProxyAfter = await this.token.balanceOf.call(
          this.proxy.address
        );
        const tokenUserProxyAfter = await this.token.balanceOf.call(
          this.userProxy.address
        );
        const tokenUserAfter = await this.token.balanceOf.call(user);
        const ethProxyAfter = await balance.current(this.proxy.address);
        const ethUserProxyAfter = await balance.current(this.userProxy.address);
        const ethUserAfter = await balance.current(user);
        const cTokenUserAfter = await this.cEther.balanceOf.call(user);
        const borrowBalanceAfter = await this.cToken.borrowBalanceCurrent.call(
          this.userProxy.address
        );
        expect(ethProxyAfter).to.be.zero;
        expect(ethUserProxyAfter).to.be.zero;
        expect(tokenProxyAfter).to.be.zero;
        expect(tokenUserProxyAfter).to.be.zero;
        expect(ethUserAfter).to.be.bignumber.eq(
          ethUserBefore.sub(new BN(receipt.receipt.gasUsed))
        );
        // balance might less than expected since debt might be slightly higher than borrowBalanceStored we got
        expect(tokenUserAfter.sub(tokenUserBefore)).to.be.bignumber.lte(
          repayAmount.sub(borrowBalanceBefore)
        );
        // assume maximum interest is 1% and the balance left after repay should be greater than this
        expect(tokenUserAfter.sub(tokenUserBefore)).to.be.bignumber.gte(
          repayAmount.sub(mulPercent(borrowBalanceBefore, 101))
        );
        expect(cTokenUserAfter).to.be.bignumber.eq(cWithdrawAmount);
        expect(borrowBalanceAfter).to.be.zero;
        profileGas(receipt);
      });

      it('only input (repay but not withdraw)', async function() {
        const repayAmount = ether('200'); // token
        const cWithdrawAmount = cUnit('0'); // cEther
        const to = this.hsCompound.address;
        const data = abi.simpleEncode(
          'repayBorrow(address,address,address,uint256,uint256)',
          this.userProxy.address,
          this.cToken.address,
          this.cEther.address,
          repayAmount,
          cWithdrawAmount
        );
        await this.token.transfer(this.proxy.address, repayAmount, {
          from: providerAddress,
        });
        await this.proxy.updateTokenMock(this.token.address);

        const tokenUserBefore = await this.token.balanceOf.call(user);
        const ethUserBefore = await balance.current(user);
        const borrowBalanceBefore = await this.cToken.borrowBalanceCurrent.call(
          this.userProxy.address
        );
        const cTokenUserProxyBefore = await this.cEther.balanceOf.call(
          this.userProxy.address
        );

        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: ether('0.1'),
        });

        const tokenProxyAfter = await this.token.balanceOf.call(
          this.proxy.address
        );
        const tokenUserProxyAfter = await this.token.balanceOf.call(
          this.userProxy.address
        );
        const tokenUserAfter = await this.token.balanceOf.call(user);
        const ethProxyAfter = await balance.current(this.proxy.address);
        const ethUserProxyAfter = await balance.current(this.userProxy.address);
        const ethUserAfter = await balance.current(user);
        const cTokenUserProxyAfter = await this.cEther.balanceOf.call(
          this.userProxy.address
        );
        const borrowBalanceAfter = await this.cToken.borrowBalanceCurrent.call(
          this.userProxy.address
        );
        expect(ethProxyAfter).to.be.zero;
        expect(ethUserProxyAfter).to.be.zero;
        expect(tokenProxyAfter).to.be.zero;
        expect(tokenUserProxyAfter).to.be.zero;
        expect(ethUserAfter).to.be.bignumber.eq(
          ethUserBefore.sub(new BN(receipt.receipt.gasUsed))
        );
        // balance might less than expected since debt might be slightly higher than borrowBalanceStored we got
        expect(tokenUserAfter.sub(tokenUserBefore)).to.be.bignumber.lte(
          repayAmount.sub(borrowBalanceBefore)
        );
        // assume maximum interest is 1% and the balance left after repay should be greater than this
        expect(tokenUserAfter.sub(tokenUserBefore)).to.be.bignumber.gte(
          repayAmount.sub(mulPercent(borrowBalanceBefore, 101))
        );
        // collateral cToken amount in DSProxy should not change
        expect(cTokenUserProxyAfter).to.be.bignumber.eq(cTokenUserProxyBefore);
        expect(borrowBalanceAfter).to.be.zero;
        profileGas(receipt);
      });

      it('only output (withdraw token)', async function() {
        const repayAmount = ether('0'); // token
        const cWithdrawAmount = cUnit('50'); // cEther
        const to = this.hsCompound.address;
        const data = abi.simpleEncode(
          'repayBorrow(address,address,address,uint256,uint256)',
          this.userProxy.address,
          this.cToken.address,
          this.cEther.address,
          repayAmount,
          cWithdrawAmount
        );
        const tokenUserBefore = await this.token.balanceOf.call(user);
        const ethUserBefore = await balance.current(user);
        const borrowBalanceBefore = await this.cToken.borrowBalanceCurrent.call(
          this.userProxy.address
        );
        const cTokenUserProxyBefore = await this.cEther.balanceOf.call(
          this.userProxy.address
        );
        const cTokenUserBefore = await this.cEther.balanceOf.call(user);

        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: ether('0.1'),
        });

        const tokenProxyAfter = await this.token.balanceOf.call(
          this.proxy.address
        );
        const tokenUserProxyAfter = await this.token.balanceOf.call(
          this.userProxy.address
        );
        const tokenUserAfter = await this.token.balanceOf.call(user);
        const ethProxyAfter = await balance.current(this.proxy.address);
        const ethUserProxyAfter = await balance.current(this.userProxy.address);
        const ethUserAfter = await balance.current(user);
        const cTokenUserProxyAfter = await this.cEther.balanceOf.call(
          this.userProxy.address
        );
        const cTokenUserAfter = await this.cEther.balanceOf.call(user);
        const borrowBalanceAfter = await this.cToken.borrowBalanceCurrent.call(
          this.userProxy.address
        );
        expect(ethProxyAfter).to.be.zero;
        expect(ethUserProxyAfter).to.be.zero;
        expect(tokenProxyAfter).to.be.zero;
        expect(tokenUserProxyAfter).to.be.zero;
        expect(ethUserAfter).to.be.bignumber.eq(
          ethUserBefore.sub(new BN(receipt.receipt.gasUsed))
        );
        // token balance of user should not change
        expect(tokenUserAfter).to.be.bignumber.eq(tokenUserBefore);
        // withdrawn cToken should be in user's wallet
        expect(cTokenUserAfter).to.be.bignumber.eq(
          cTokenUserBefore.add(cWithdrawAmount)
        );
        // cToken amount in DSProxy should decrease
        expect(cTokenUserProxyAfter).to.be.bignumber.eq(
          cTokenUserProxyBefore.sub(cWithdrawAmount)
        );
        // borrorw balance should not decrease, but may increase slightly
        expect(borrowBalanceAfter).to.be.bignumber.not.lt(borrowBalanceBefore);
        profileGas(receipt);
      });

      it('should revert: not dsproxy owner', async function() {
        const repayAmount = ether('200'); // token
        const cWithdrawAmount = cUnit('450'); // cEther
        const to = this.hsCompound.address;
        const data = abi.simpleEncode(
          'repayBorrow(address,address,address,uint256,uint256)',
          this.userProxy.address,
          this.cToken.address,
          this.cEther.address,
          repayAmount,
          cWithdrawAmount
        );
        await this.token.transfer(this.proxy.address, repayAmount, {
          from: providerAddress,
        });
        await this.proxy.updateTokenMock(this.token.address);
        await expectRevert(
          this.proxy.execMock(to, data, {
            from: someone,
          }),
          'HSCompound_General: Not owner of the DSProxy'
        );
      });
    });
  });

  describe('Claim COMP', function() {
    let compUserProxyBefore;
    before(async function() {
      await this.comptroller.claimComp(this.userProxy.address);
    });

    beforeEach(async function() {
      await this.cEther.mint({
        from: _,
        value: ether('10'),
      });
      const mintBalance = await this.cEther.balanceOf.call(_);
      await this.cEther.transfer(this.userProxy.address, mintBalance, {
        from: _,
      });
      await increase(duration.days(1));
      compUserProxyBefore = await this.comp.balanceOf.call(
        this.userProxy.address
      );
    });

    // NOTE: Because COMP Hack event, compound stop to issue $COMP now.
    // Remove `skip` when compound issue $COMP again.
    it.skip('normal', async function() {
      const to = this.hsCompound.address;
      const data = abi.simpleEncode(
        'claimComp(address)',
        this.userProxy.address
      );
      const receipt = await this.proxy.execMock(to, data, {
        from: user,
        value: ether('0.1'),
      });
      // Get handler return result
      const handlerReturn = utils.toBN(
        getHandlerReturn(receipt, ['uint256'])[0]
      );
      const compUserAfter = await this.comp.balanceOf.call(user);
      const compUserProxyAfter = await this.comp.balanceOf.call(
        this.userProxy.address
      );
      const compProxyAfter = await this.comp.balanceOf.call(this.proxy.address);
      expect(compUserProxyAfter).to.be.zero;
      expect(compProxyAfter).to.be.zero;
      // Can't get the exact result so we only check if the amount is greater than before
      expect(compUserAfter).to.be.bignumber.gt(compUserProxyBefore);
      expect(compUserAfter).to.be.bignumber.eq(handlerReturn);
      profileGas(receipt);
    });

    it('should revert: not dsproxy owner', async function() {
      const to = this.hsCompound.address;
      const data = abi.simpleEncode(
        'claimComp(address)',
        this.userProxy.address
      );
      await expectRevert(
        this.proxy.execMock(to, data, {
          from: someone,
        }),
        'HSCompound_General: Not owner of the DSProxy'
      );
    });
  });
});
