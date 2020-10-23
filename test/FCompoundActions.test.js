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
    CETHER,
    ETH_TOKEN,
    MAKER_PROXY_REGISTRY,
    CREATE2_FACTORY,
    FCOMPOUND_ACTIONS_SALT,
    FCOMPOUND_ACTIONS,
    COMPOUND_COMPTROLLER,
  } = require('./utils/constants');
  const { evmRevert, evmSnapshot, profileGas } = require('./utils/utils');
  const { getFCompoundActionsBytecodeBySolc } = require('./utils/getBytecode');
  
  const FCompoundActions = artifacts.require('FCompoundActions');
  const DSGuardFactory = artifacts.require('DSGuardFactory');
  const DSAuthority = artifacts.require('DSAuthority');
  const IDSProxyRegistry = artifacts.require('IDSProxyRegistry');
  const IDSProxy = artifacts.require('IDSProxy');
  const ISingletonFactory = artifacts.require('ISingletonFactory');
  const IComptroller = artifacts.require('IComptroller');
  const ICEther = artifacts.require('ICEther');
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
      this.cToken = await IToken.at(cTokenAddress);
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
        await this.token.transfer(user0, amount, {from: providerAddress});
        await this.token.approve(this.user0Proxy.address, amount, {from: user0});
        const tokenProxyBefore = await this.token.balanceOf.call(this.user0Proxy.address);
        const tokenUser0Before = await this.token.balanceOf.call(user0);

        const receipt = await this.user0Proxy.execute(FCOMPOUND_ACTIONS, data, {from: user0});

        const tokenProxyAfter = await this.token.balanceOf.call(this.user0Proxy.address);
        const tokenUser0After = await this.token.balanceOf.call(user0);
        expect(tokenProxyAfter).to.be.bignumber.eq(
            tokenProxyBefore.add(amount)
        );
        expect(tokenUser0After).to.be.bignumber.eq(
            tokenUser0Before.sub(amount)
        );
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
          
          const receipt = await this.user0Proxy.execute(FCOMPOUND_ACTIONS, data, {from: user0});
          
          const ethProxyAfter = await balance.current(this.user0Proxy.address);
          const ethUser0After = await balance.current(user0);
          expect(ethProxyAfter).to.be.bignumber.eq(
              ethProxyBefore.sub(amount)
          );
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
            await this.token.transfer(this.user0Proxy.address, amount, {from: providerAddress});
            const tokenProxyBefore = await this.token.balanceOf.call(this.user0Proxy.address);
            const tokenUser0Before = await this.token.balanceOf.call(user0);

            const receipt = await this.user0Proxy.execute(FCOMPOUND_ACTIONS, data, {from: user0});
            
            const tokenProxyAfter = await this.token.balanceOf.call(this.user0Proxy.address);
            const tokenUser0After = await this.token.balanceOf.call(user0);
            expect(tokenProxyAfter).to.be.bignumber.eq(
                tokenProxyBefore.sub(amount)
            );
            expect(tokenUser0After).to.be.bignumber.eq(
                tokenUser0Before.add(amount)
            );
          });
      });

      describe('Market', function() {
        it('enter single', async function() {
            const isEnteredBefore = await this.comptroller.checkMembership.call(this.user0Proxy.address, this.cToken.address);
            expect(isEnteredBefore).to.be.false;
            const data = abi.simpleEncode(
                'enterMarket(address)',
                this.cToken.address,
            );
            // User DSProxy enter market
            await this.user0Proxy.execute(FCOMPOUND_ACTIONS, data, {from: user0});
            const isEnteredAfter = await this.comptroller.checkMembership.call(this.user0Proxy.address, this.cToken.address);
            expect(isEnteredAfter).to.be.true;
        });

        // TODO: enter single revert (non cToken)
        // TODO: enter multiple
        // TODO: exit

      });

      describe('Borrow', function() {
        beforeEach(async function() {
            await this.cEther.mint({
              from: _,
              value: ether('10'),
            });
            const mintBalance = await this.cEther.balanceOf.call(_);
            await this.cEther.transfer(this.user0Proxy.address, mintBalance, {from: _});
            const data = abi.simpleEncode(
                'enterMarket(address)',
                this.cEther.address,
            );
            // User DSProxy enter market
            await this.user0Proxy.execute(FCOMPOUND_ACTIONS, data, {from: user0});
        });

        it('borrow ether', async function() {
          const borrowAddress = this.cEther.address;
          const amount = ether('1');
          const data = abi.simpleEncode(
            'borrow(address,uint256)',
            borrowAddress,
            amount,
            );
          
          const ethProxyBefore = await balance.current(this.user0Proxy.address);
          const ethUser0Before = await balance.current(user0);
          
          const receipt = await this.user0Proxy.execute(FCOMPOUND_ACTIONS, data, {from: user0});
          
          const ethProxyAfter = await balance.current(this.user0Proxy.address);
          const ethUser0After = await balance.current(user0);
          expect(ethProxyAfter).to.be.bignumber.eq(
              ethProxyBefore.add(amount)
          );
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
              amount,
              );
            
            const tokenProxyBefore = await this.token.balanceOf.call(this.user0Proxy.address);
            const tokenUser0Before = await this.token.balanceOf.call(user0);

            const receipt = await this.user0Proxy.execute(FCOMPOUND_ACTIONS, data, {from: user0});
            
            const tokenProxyAfter = await this.token.balanceOf.call(this.user0Proxy.address);
            const tokenUser0After = await this.token.balanceOf.call(user0);
            expect(tokenProxyAfter).to.be.bignumber.eq(
                tokenProxyBefore.add(amount)
            );
            expect(tokenUser0After).to.be.bignumber.eq(
                tokenUser0Before
            );
          });
      });
  
  });
  