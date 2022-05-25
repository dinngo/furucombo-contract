const {
  balance,
  BN,
  constants,
  ether,
  expectRevert,
} = require('@openzeppelin/test-helpers');
const { tracker } = balance;
const { MAX_UINT256 } = constants;
const abi = require('ethereumjs-abi');
const utils = web3.utils;

const { expect } = require('chai');

const {
  CDAI,
  CETHER,
  DAI_TOKEN,
  COMPOUND_COMPTROLLER,
} = require('./utils/constants');
const {
  evmRevert,
  evmSnapshot,
  profileGas,
  getHandlerReturn,
  tokenProviderUniV2,
} = require('./utils/utils');

const HCToken = artifacts.require('HCToken');
const Registry = artifacts.require('Registry');
const Proxy = artifacts.require('ProxyMock');
const IToken = artifacts.require('IERC20');
const ICEther = artifacts.require('ICEther');
const ICToken = artifacts.require('ICToken');
const IComptroller = artifacts.require('IComptroller');

contract('CToken', function([_, user]) {
  let id;
  const cTokenAddress = CDAI;
  const tokenAddress = DAI_TOKEN;

  let balanceUser;
  let balanceProxy;
  let tokenUser;
  let cTokenUser;
  let providerAddress;

  before(async function() {
    providerAddress = await tokenProviderUniV2(tokenAddress);

    this.registry = await Registry.new();
    this.proxy = await Proxy.new(this.registry.address);
    this.hCToken = await HCToken.new();
    await this.registry.register(
      this.hCToken.address,
      utils.asciiToHex('CToken')
    );
    this.token = await IToken.at(tokenAddress);
    this.cToken = await ICToken.at(cTokenAddress);
  });

  beforeEach(async function() {
    id = await evmSnapshot();
    balanceUser = await tracker(user);
    balanceProxy = await tracker(this.proxy.address);
  });

  afterEach(async function() {
    await evmRevert(id);
  });

  describe('Mint', function() {
    it('normal', async function() {
      const value = ether('10');
      const to = this.hCToken.address;
      const data = abi.simpleEncode(
        'mint(address,uint256)',
        cTokenAddress,
        value
      );
      await this.token.transfer(this.proxy.address, value, {
        from: providerAddress,
      });
      await this.proxy.updateTokenMock(this.token.address);
      cTokenUser = await this.cToken.balanceOf.call(user);

      const rate = await this.cToken.exchangeRateStored.call();
      const result = value.mul(ether('1')).div(rate);
      const receipt = await this.proxy.execMock(to, data, { from: user });

      // Get handler return result
      const handlerReturn = utils.toBN(
        getHandlerReturn(receipt, ['uint256'])[0]
      );
      cTokenUserEnd = await this.cToken.balanceOf.call(user);
      expect(cTokenUserEnd.sub(cTokenUser)).to.be.bignumber.eq(handlerReturn);
      expect(
        cTokenUserEnd.mul(new BN('1000')).divRound(result)
      ).to.be.bignumber.eq(new BN('1000'));
      expect(await balanceUser.delta()).to.be.bignumber.eq(ether('0'));
      profileGas(receipt);
    });

    it('max amount', async function() {
      const value = ether('10');
      const to = this.hCToken.address;
      const data = abi.simpleEncode(
        'mint(address,uint256)',
        cTokenAddress,
        MAX_UINT256
      );
      await this.token.transfer(this.proxy.address, value, {
        from: providerAddress,
      });
      await this.proxy.updateTokenMock(this.token.address);
      cTokenUser = await this.cToken.balanceOf.call(user);

      const rate = await this.cToken.exchangeRateStored.call();
      const result = value.mul(ether('1')).div(rate);
      const receipt = await this.proxy.execMock(to, data, { from: user });

      // Get handler return result
      const handlerReturn = utils.toBN(
        getHandlerReturn(receipt, ['uint256'])[0]
      );

      cTokenUserEnd = await this.cToken.balanceOf.call(user);
      expect(cTokenUserEnd.sub(cTokenUser)).to.be.bignumber.eq(handlerReturn);
      expect(
        cTokenUserEnd.mul(new BN('1000')).divRound(result)
      ).to.be.bignumber.eq(new BN('1000'));
      expect(await balanceUser.delta()).to.be.bignumber.eq(ether('0'));
      profileGas(receipt);
    });

    it('revert', async function() {
      const value = ether('10');
      const to = this.hCToken.address;
      const data = abi.simpleEncode(
        'mint(address,uint256)',
        cTokenAddress,
        value
      );
      await this.proxy.updateTokenMock(this.token.address);
      await expectRevert(
        this.proxy.execMock(to, data, { from: user }),
        'HCToken_mint: Dai/insufficient-balance'
      );
    });

    it('revert', async function() {
      const value = ether('10');
      const to = this.hCToken.address;
      const data = abi.simpleEncode(
        'mint(address,uint256)',
        cTokenAddress,
        value
      );
      await this.proxy.updateTokenMock(this.token.address);
      await expectRevert(
        this.proxy.execMock(to, data, { from: user }),
        'HCToken_mint: Dai/insufficient-balance'
      );
    });
  });

  describe('Redeem', function() {
    beforeEach(async function() {
      await this.token.transfer(user, ether('1'), { from: providerAddress });
      await this.token.approve(this.cToken.address, ether('1'), { from: user });
      await this.cToken.mint(ether('1'), { from: user });
      tokenUser = await this.token.balanceOf.call(user);
      cTokenUser = await this.cToken.balanceOf.call(user);
    });

    it('normal', async function() {
      const value = cTokenUser;
      const to = this.hCToken.address;
      const data = abi.simpleEncode(
        'redeem(address,uint256)',
        this.cToken.address,
        value
      );
      const rate = await this.cToken.exchangeRateStored.call();
      const result = value.mul(rate).div(ether('1'));
      await this.cToken.transfer(this.proxy.address, value, { from: user });
      await this.proxy.updateTokenMock(this.cToken.address);
      tokenUser = await this.token.balanceOf.call(user);
      cTokenUser = await this.cToken.balanceOf.call(user);
      const receipt = await this.proxy.execMock(to, data, {
        from: user,
        value: ether('0.1'),
      });

      // Get handler return result
      const handlerReturn = utils.toBN(
        getHandlerReturn(receipt, ['uint256'])[0]
      );

      tokenUserEnd = await this.token.balanceOf.call(user);
      expect(tokenUserEnd.sub(tokenUser)).to.be.bignumber.eq(handlerReturn);

      expect(await this.cToken.balanceOf.call(user)).to.be.bignumber.eq(
        ether('0')
      );
      expect(
        (await this.token.balanceOf.call(user))
          .sub(tokenUser)
          .mul(new BN('1000'))
          .divRound(result)
      ).to.be.bignumber.eq(new BN('1000'));
      profileGas(receipt);
    });

    it('max amount', async function() {
      const value = cTokenUser;
      const to = this.hCToken.address;
      const data = abi.simpleEncode(
        'redeem(address,uint256)',
        this.cToken.address,
        value
      );
      const rate = await this.cToken.exchangeRateStored.call();
      const result = value.mul(rate).div(ether('1'));
      await this.cToken.transfer(this.proxy.address, value, { from: user });
      await this.proxy.updateTokenMock(this.cToken.address);
      tokenUser = await this.token.balanceOf.call(user);
      cTokenUser = await this.cToken.balanceOf.call(user);
      const receipt = await this.proxy.execMock(to, data, {
        from: user,
        value: ether('0.1'),
      });

      // Get handler return result
      const handlerReturn = utils.toBN(
        getHandlerReturn(receipt, ['uint256'])[0]
      );

      tokenUserEnd = await this.token.balanceOf.call(user);
      expect(tokenUserEnd.sub(tokenUser)).to.be.bignumber.eq(handlerReturn);

      expect(await this.cToken.balanceOf.call(user)).to.be.bignumber.eq(
        ether('0')
      );
      expect(
        (await this.token.balanceOf.call(user))
          .sub(tokenUser)
          .mul(new BN('1000'))
          .divRound(result)
      ).to.be.bignumber.eq(new BN('1000'));
      profileGas(receipt);
    });

    it('revert', async function() {
      const value = cTokenUser;
      const to = this.hCToken.address;
      const data = abi.simpleEncode(
        'redeem(address,uint256)',
        this.cToken.address,
        value
      );
      await this.proxy.updateTokenMock(this.cToken.address);
      await expectRevert(
        this.proxy.execMock(to, data, {
          from: user,
          value: ether('0.1'),
        }),
        'HCToken_redeem: Unspecified'
      );
    });

    it('revert', async function() {
      const value = cTokenUser;
      const to = this.hCToken.address;
      const data = abi.simpleEncode(
        'redeem(address,uint256)',
        this.cToken.address,
        value
      );
      await this.proxy.updateTokenMock(this.cToken.address);
      await expectRevert(
        this.proxy.execMock(to, data, {
          from: user,
          value: ether('0.1'),
        }),
        'HCToken_redeem: Unspecified'
      );
    });
  });

  describe('Redeem Underlying', function() {
    beforeEach(async function() {
      await this.token.transfer(user, ether('100'), { from: providerAddress });
      await this.token.approve(this.cToken.address, ether('100'), {
        from: user,
      });
      await this.cToken.mint(ether('100'), { from: user });
      tokenUser = await this.token.balanceOf.call(user);
      cTokenUser = await this.cToken.balanceOf.call(user);
    });

    it('normal', async function() {
      const value = ether('100');
      const to = this.hCToken.address;
      const data = abi.simpleEncode(
        'redeemUnderlying(address,uint256)',
        this.cToken.address,
        value
      );
      const rate = await this.cToken.exchangeRateStored.call();
      const result = value.mul(ether('1')).div(rate);
      await this.cToken.transfer(this.proxy.address, cTokenUser, {
        from: user,
      });
      await this.proxy.updateTokenMock(this.cToken.address);
      const receipt = await this.proxy.execMock(to, data, {
        from: user,
        value: ether('0.1'),
      });

      // Get handler return result
      const handlerReturn = utils.toBN(
        getHandlerReturn(receipt, ['uint256'])[0]
      );
      const cTokenUserEnd = await this.cToken.balanceOf.call(user);
      expect(handlerReturn).to.be.bignumber.eq(cTokenUser.sub(cTokenUserEnd));

      expect(
        (await this.token.balanceOf.call(user)).sub(tokenUser)
      ).to.be.bignumber.eq(value);
      /* Fix this
      expect(
        (await this.cToken.balanceOf.call(user)).sub(cTokenUser.sub(result))
      ).to.be.bignumber.lt(new BN('1000'));
      */
      profileGas(receipt);
    });

    it('revert', async function() {
      const value = ether('100');
      const to = this.hCToken.address;
      const data = abi.simpleEncode(
        'redeemUnderlying(address,uint256)',
        this.cToken.address,
        value
      );
      await this.proxy.updateTokenMock(this.cToken.address);
      // cTokenUser = await this.cToken.balanceOf.call(user);
      await expectRevert(
        this.proxy.execMock(to, data, {
          from: user,
          value: ether('0.1'),
        }),
        'HCToken_redeemUnderlying: Unspecified'
      );
    });
  });

  describe('Repay Borrow Behalf', function() {
    before(async function() {
      this.comptroller = await IComptroller.at(COMPOUND_COMPTROLLER);
      this.cether = await await ICEther.at(CETHER);
      await this.comptroller.enterMarkets([CETHER], { from: user });
    });
    beforeEach(async function() {
      await this.cether.mint({ from: user, value: ether('1') });
      await this.cToken.borrow(ether('1'), { from: user });
    });

    it('normal', async function() {
      const value = MAX_UINT256;
      const to = this.hCToken.address;
      const data = abi.simpleEncode(
        'repayBorrowBehalf(address,address,uint256)',
        this.cToken.address,
        user,
        value
      );
      await this.token.transfer(this.proxy.address, ether('10'), {
        from: providerAddress,
      });
      await this.proxy.updateTokenMock(this.token.address);
      const receipt = await this.proxy.execMock(to, data, {
        from: user,
        value: ether('0.1'),
      });
      // Get handler return result
      const handlerReturn = utils.toBN(
        getHandlerReturn(receipt, ['uint256'])[0]
      );

      expect(
        await this.cToken.borrowBalanceCurrent.call(user)
      ).to.be.bignumber.eq(handlerReturn);

      expect(
        await this.cToken.borrowBalanceCurrent.call(user)
      ).to.be.bignumber.eq(ether('0'));
    });

    it('insufficient token', async function() {
      const value = MAX_UINT256;
      const to = this.hCToken.address;
      const data = abi.simpleEncode(
        'repayBorrowBehalf(address,address,uint256)',
        this.cToken.address,
        user,
        value
      );
      await this.token.transfer(this.proxy.address, ether('0.8'), {
        from: providerAddress,
      });
      await this.proxy.updateTokenMock(this.token.address);
      await expectRevert(
        this.proxy.execMock(to, data, {
          from: user,
          value: ether('0.1'),
        }),
        'HCToken_repayBorrowBehalf: Dai/insufficient-balance'
      );
    });
  });
});
