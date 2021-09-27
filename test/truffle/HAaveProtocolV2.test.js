const {
  balance,
  BN,
  constants,
  ether,
  expectEvent,
  expectRevert,
  time,
} = require('@openzeppelin/test-helpers');
const { MAX_UINT256 } = constants;
const { tracker } = balance;
const { latest } = time;
const abi = require('ethereumjs-abi');
const util = require('ethereumjs-util');
const utils = web3.utils;

const { expect } = require('chai');

const {
  WETH_TOKEN,
  WETH_PROVIDER,
  DAI_TOKEN,
  DAI_PROVIDER,
  ADAI_V2,
  AWETH_V2,
  AAVEPROTOCOL_V2_PROVIDER,
  AAVE_RATEMODE,
} = require('./utils/constants');
const {
  evmRevert,
  evmSnapshot,
  profileGas,
  getHandlerReturn,
  mulPercent,
  errorCompare,
} = require('./utils/utils');

const HAaveV2 = artifacts.require('HAaveProtocolV2');
const Registry = artifacts.require('Registry');
const Proxy = artifacts.require('ProxyMock');
const IToken = artifacts.require('IERC20');
const IAToken = artifacts.require('IATokenV2');
const ILendingPool = artifacts.require('ILendingPoolV2');
const IProvider = artifacts.require('ILendingPoolAddressesProviderV2');
const SimpleToken = artifacts.require('SimpleToken');

contract('Aave V2', function([_, user, someone]) {
  const aTokenAddress = ADAI_V2;
  const tokenAddress = DAI_TOKEN;
  const providerAddress = DAI_PROVIDER;
  const awethAddress = AWETH_V2;
  const wethAddress = WETH_TOKEN;
  const wethProviderAddress = WETH_PROVIDER;

  let id;
  let balanceUser;
  let balanceProxy;

  before(async function() {
    this.registry = await Registry.new();
    this.proxy = await Proxy.new(this.registry.address);
    this.hAaveV2 = await HAaveV2.new();
    await this.registry.register(
      this.hAaveV2.address,
      utils.asciiToHex('AaveProtocolV2')
    );
    this.provider = await IProvider.at(AAVEPROTOCOL_V2_PROVIDER);
    this.lendingPoolAddress = await this.provider.getLendingPool.call();
    this.lendingPool = await ILendingPool.at(this.lendingPoolAddress);
    this.token = await IToken.at(tokenAddress);
    this.aToken = await IAToken.at(aTokenAddress);
    this.weth = await IToken.at(WETH_TOKEN);
    this.aweth = await IAToken.at(awethAddress);
    this.mockToken = await SimpleToken.new();

  });

  beforeEach(async function() {
    id = await evmSnapshot();
    balanceUser = await tracker(user);
    balanceProxy = await tracker(this.proxy.address);
  });

  afterEach(async function() {
    await evmRevert(id);
  });

  describe('Deposit', function() {
    describe('Ether', function() {
      it('normal', async function() {
        const value = ether('10');
        const to = this.hAaveV2.address;
        const data = abi.simpleEncode('depositETH(uint256)', value);

        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: value,
        });
        expect(await balanceProxy.get()).to.be.zero;
        expect(await this.aweth.balanceOf.call(this.proxy.address)).to.be.zero;
        expect(await this.aweth.balanceOf.call(user)).to.be.bignumber.eq(value);
        expect(await balanceUser.delta()).to.be.bignumber.eq(
          ether('0')
            .sub(value)
            .sub(new BN(receipt.receipt.gasUsed))
        );
        profileGas(receipt);
      });

      it('max amount', async function() {
        const value = ether('10');
        const to = this.hAaveV2.address;
        const data = abi.simpleEncode('depositETH(uint256)', MAX_UINT256);

        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: value,
        });
        expect(await balanceProxy.get()).to.be.zero;
        expect(await this.aweth.balanceOf.call(this.proxy.address)).to.be.zero;
        expect(await this.aweth.balanceOf.call(user)).to.be.bignumber.eq(value);
        expect(await balanceUser.delta()).to.be.bignumber.eq(
          ether('0')
            .sub(value)
            .sub(new BN(receipt.receipt.gasUsed))
        );
        profileGas(receipt);
      });
    });

    describe('Token', function() {
      it('normal', async function() {
        const value = ether('10');
        const to = this.hAaveV2.address;
        const data = abi.simpleEncode(
          'deposit(address,uint256)',
          this.token.address,
          value
        );

        await this.token.transfer(this.proxy.address, value, {
          from: providerAddress,
        });
        await this.proxy.updateTokenMock(this.token.address);

        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: ether('0.1'),
        });
        expect(await balanceProxy.get()).to.be.zero;
        expect(await this.aToken.balanceOf.call(this.proxy.address)).to.be.zero;
        expect(await this.aToken.balanceOf.call(user)).to.be.bignumber.eq(
          value
        );
        expect(await balanceUser.delta()).to.be.bignumber.eq(
          ether('0').sub(new BN(receipt.receipt.gasUsed))
        );
        profileGas(receipt);
      });

      it('max amount', async function() {
        const value = ether('10');
        const to = this.hAaveV2.address;
        const data = abi.simpleEncode(
          'deposit(address,uint256)',
          this.token.address,
          MAX_UINT256
        );

        await this.token.transfer(this.proxy.address, value, {
          from: providerAddress,
        });
        await this.proxy.updateTokenMock(this.token.address);

        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: ether('0.1'),
        });
        expect(await balanceProxy.get()).to.be.zero;
        expect(await this.aToken.balanceOf.call(this.proxy.address)).to.be.zero;
        expect(await this.aToken.balanceOf.call(user)).to.be.bignumber.eq(
          value
        );

        expect(await balanceUser.delta()).to.be.bignumber.eq(
          ether('0').sub(new BN(receipt.receipt.gasUsed))
        );
        profileGas(receipt);
      });

      it('should revert: not supported token', async function() {
        const value = ether('10');
        const to = this.hAaveV2.address;
        const data = abi.simpleEncode(
          'deposit(address,uint256)',
          this.mockToken.address,
          value
        );
        await this.mockToken.transfer(this.proxy.address, value, { from: _ });
        await expectRevert(
          this.proxy.execMock(to, data, { from: user }),
          'HAaveProtocolV2_General: aToken should not be zero address'
        );
      });
    });
  });

  describe('Withdraw', function() {
    var depositAmount = ether('5');

    describe('Ether', function() {
      beforeEach(async function() {
        await this.weth.approve(this.lendingPool.address, depositAmount, {
          from: wethProviderAddress,
        });
        await this.lendingPool.deposit(
          this.weth.address,
          depositAmount,
          user,
          0,
          { from: wethProviderAddress }
        );

        depositAmount = await this.aweth.balanceOf.call(user);
      });

      it('partial', async function() {
        const value = depositAmount.div(new BN(2));
        const to = this.hAaveV2.address;
        const data = abi.simpleEncode('withdrawETH(uint256)', value);
        await this.aweth.transfer(this.proxy.address, value, { from: user });
        await this.proxy.updateTokenMock(this.aweth.address);
        await balanceUser.get();

        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: ether('0.1'),
        });

        // Get handler return result
        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );
        const aTokenUserAfter = await this.aweth.balanceOf.call(user);
        const interestMax = depositAmount.mul(new BN(1)).div(new BN(10000));

        // Verify handler return
        expect(value).to.be.bignumber.eq(handlerReturn);
        // Verify proxy balance
        expect(await this.aweth.balanceOf.call(this.proxy.address)).to.be.zero;
        // Verify user balance
        // (deposit - withdraw) <= aTokenAfter < (deposit + interestMax - withdraw)
        expect(aTokenUserAfter).to.be.bignumber.gte(depositAmount.sub(value));
        expect(aTokenUserAfter).to.be.bignumber.lt(
          depositAmount.add(interestMax).sub(value)
        );
        expect(await balanceUser.delta()).to.be.bignumber.eq(
          value.sub(new BN(receipt.receipt.gasUsed))
        );
        profileGas(receipt);
      });

      it('max amount', async function() {
        const value = depositAmount.div(new BN(2));
        const to = this.hAaveV2.address;
        const data = abi.simpleEncode('withdrawETH(uint256)', MAX_UINT256);
        await this.aweth.transfer(this.proxy.address, value, { from: user });
        await this.proxy.updateTokenMock(this.aweth.address);
        var userBanalceCur = await balanceUser.get();
        console.log('userBanalceCur:' + userBanalceCur);

        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: ether('0.1'),
        });

        // Get handler return result
        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );
        const aTokenUserAfter = await this.aweth.balanceOf.call(user);
        const interestMax = depositAmount.mul(new BN(1)).div(new BN(10000));

        // Verify handler return
        // value  <= handlerReturn  <= value*1.01
        // Because AToken could be increase by timestamp in proxy
        expect(value).to.be.bignumber.lte(handlerReturn);
        expect(mulPercent(value, 101)).to.be.bignumber.gte(handlerReturn);

        // Verify proxy balance
        expect(await this.aweth.balanceOf.call(this.proxy.address)).to.be.zero;
        // Verify user balance
        // (deposit - withdraw) <= aTokenAfter < (deposit + interestMax - withdraw)
        // NOTE: aTokenUserAfter == (depositAmount - withdraw - 1) (sometime, Ganache bug maybe)
        expect(aTokenUserAfter).to.be.bignumber.gte(
          depositAmount.sub(handlerReturn.add(new BN(1)))
        );
        expect(aTokenUserAfter).to.be.bignumber.lt(
          depositAmount.add(interestMax).sub(handlerReturn)
        );        
        expect(await balanceUser.delta()).to.be.bignumber.eq(
          value.sub(new BN(receipt.receipt.gasUsed))
        );
        profileGas(receipt);
      });
    });

    describe('Token', function() {
      beforeEach(async function() {
        await this.token.approve(this.lendingPool.address, depositAmount, {
          from: providerAddress,
        });
        await this.lendingPool.deposit(
          this.token.address,
          depositAmount,
          user,
          0,
          { from: providerAddress }
        );

        depositAmount = await this.aToken.balanceOf.call(user);
      });

      it('partial', async function() {
        const value = depositAmount.div(new BN(2));
        const to = this.hAaveV2.address;
        const data = abi.simpleEncode(
          'withdraw(address,uint256)',
          this.token.address,
          value
        );

        await this.aToken.transfer(this.proxy.address, value, { from: user });
        await this.proxy.updateTokenMock(this.aToken.address);
        await balanceUser.get();
        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: ether('0.1'),
        });

        // Get handler return result
        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );
        const aTokenUserAfter = await this.aToken.balanceOf.call(user);
        const tokenUserAfter = await this.token.balanceOf.call(user);
        const interestMax = depositAmount.mul(new BN(1)).div(new BN(10000));

        // Verify handler return
        expect(value).to.be.bignumber.eq(handlerReturn);
        // Verify proxy balance
        expect(await this.aToken.balanceOf.call(this.proxy.address)).to.be.zero;
        expect(await this.token.balanceOf.call(this.proxy.address)).to.be.zero;

        // Verify user balance
        // (deposit - withdraw) <= aTokenAfter < (deposit + interestMax - withdraw)
        expect(aTokenUserAfter).to.be.bignumber.gte(depositAmount.sub(value));
        expect(aTokenUserAfter).to.be.bignumber.lt(
          depositAmount.add(interestMax).sub(value)
        );
        expect(tokenUserAfter).to.be.bignumber.eq(value);
        expect(await balanceUser.delta()).to.be.bignumber.eq(
          ether('0').sub(new BN(receipt.receipt.gasUsed))
        );
        profileGas(receipt);
      });

      it('max amount', async function() {
        const value = depositAmount.div(new BN(2));
        const to = this.hAaveV2.address;
        const data = abi.simpleEncode(
          'withdraw(address,uint256)',
          this.token.address,
          MAX_UINT256
        );
        await this.aToken.transfer(this.proxy.address, value, { from: user });
        await this.proxy.updateTokenMock(this.aToken.address);
        await balanceUser.get();

        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: ether('0.1'),
        });

        // Get handler return result
        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );
        const aTokenUserAfter = await this.aToken.balanceOf.call(user);
        const tokenUserAfter = await this.token.balanceOf.call(user);
        const interestMax = depositAmount.mul(new BN(1)).div(new BN(10000));

        // Verify handler return
        // value  <= handlerReturn  <= value*1.01
        // Because AToken could be increase by timestamp in proxy
        expect(value).to.be.bignumber.lte(handlerReturn);
        expect(mulPercent(value, 101)).to.be.bignumber.gte(handlerReturn);

        // Verify proxy balance
        expect(await this.aToken.balanceOf.call(this.proxy.address)).to.be.zero;
        expect(await this.token.balanceOf.call(this.proxy.address)).to.be.zero;
        // Verify user balance
        // (deposit - withdraw -1) <= aTokenAfter < (deposit + interestMax - withdraw)
        // NOTE: aTokenUserAfter == (depositAmount - withdraw - 1) (sometime, Ganache bug maybe)
        expect(aTokenUserAfter).to.be.bignumber.gte(
          depositAmount.sub(handlerReturn.add(new BN(1)))
        );
        expect(aTokenUserAfter).to.be.bignumber.lt(
          depositAmount.add(interestMax).sub(handlerReturn)
        );
        expect(tokenUserAfter).to.be.bignumber.eq(handlerReturn);
        expect(await balanceUser.delta()).to.be.bignumber.eq(
          ether('0').sub(new BN(receipt.receipt.gasUsed))
        );
        profileGas(receipt);
      });

      it('whole', async function() {
        const value = MAX_UINT256;
        const to = this.hAaveV2.address;
        const data = abi.simpleEncode(
          'withdraw(address,uint256)',
          this.token.address,
          value
        );
        await this.aToken.transfer(
          this.proxy.address,
          await this.aToken.balanceOf.call(user),
          { from: user }
        );
        await this.proxy.updateTokenMock(this.aToken.address);
        await balanceUser.get();

        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: ether('0.1'),
        });

        // Get handler return result
        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );
        const aTokenUserAfter = await this.aToken.balanceOf.call(user);
        const tokenUserAfter = await this.token.balanceOf.call(user);

        // Verify handler return
        expect(handlerReturn).to.be.bignumber.gte(depositAmount);
        // Verify proxy balance
        expect(await this.aToken.balanceOf.call(this.proxy.address)).to.be.zero;
        expect(await this.token.balanceOf.call(this.proxy.address)).to.be.zero;
        // Verify user balance
        expect(aTokenUserAfter).to.be.zero;
        expect(tokenUserAfter).to.be.bignumber.eq(handlerReturn);
        expect(await balanceUser.delta()).to.be.bignumber.eq(
          ether('0').sub(new BN(receipt.receipt.gasUsed))
        );
        profileGas(receipt);
      });

      it('should revert: not enough balance', async function() {
        const value = depositAmount.add(ether('10'));
        const to = this.hAaveV2.address;
        const data = abi.simpleEncode(
          'withdraw(address,uint256)',
          this.token.address,
          value
        );

        await this.aToken.transfer(
          this.proxy.address,
          await this.aToken.balanceOf.call(user),
          { from: user }
        );
        await this.proxy.updateTokenMock(this.aToken.address);

        await expectRevert(
          this.proxy.execMock(to, data, { from: user }),
          'HAaveProtocolV2_withdraw: 5'
        );
      });

      it('should revert: not supported token', async function() {
        const value = depositAmount.add(ether('10'));
        const to = this.hAaveV2.address;
        const data = abi.simpleEncode(
          'withdraw(address,uint256)',
          this.mockToken.address,
          value
        );

        await expectRevert(
          this.proxy.execMock(to, data, { from: user }),
          'HAaveProtocolV2_General: aToken should not be zero address'
        );
      });
    });
  });
});
