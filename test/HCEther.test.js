if (network.config.chainId == 1) {
  // This test supports to run on these chains.
} else {
  return;
}

const {
  balance,
  BN,
  constants,
  ether,
  expectRevert,
  time,
} = require('@openzeppelin/test-helpers');
const { tracker } = balance;
const { MAX_UINT256 } = constants;
const abi = require('ethereumjs-abi');
const utils = web3.utils;

const { expect } = require('chai');

const {
  CETHER,
  CDAI,
  DAI_TOKEN,
  COMPOUND_COMPTROLLER,
} = require('./utils/constants');
const {
  evmRevert,
  evmSnapshot,
  profileGas,
  getHandlerReturn,
  tokenProviderUniV2,
  expectEqWithinBps,
} = require('./utils/utils');

const HCEther = artifacts.require('HCEther');
const FeeRuleRegistry = artifacts.require('FeeRuleRegistry');
const Registry = artifacts.require('Registry');
const Proxy = artifacts.require('ProxyMock');
const IToken = artifacts.require('IERC20');
const ICEther = artifacts.require('ICEther');
const ICToken = artifacts.require('ICToken');
const IComptroller = artifacts.require('IComptroller');

contract('CEther', function ([_, user]) {
  const tokenAddress = DAI_TOKEN;

  let id;
  let balanceUser;
  let balanceProxy;
  let cEtherUser;
  let providerAddress;

  before(async function () {
    providerAddress = await tokenProviderUniV2(tokenAddress);

    this.registry = await Registry.new();
    this.hCEther = await HCEther.new();
    await this.registry.register(
      this.hCEther.address,
      utils.asciiToHex('CEther')
    );
    this.cEther = await ICEther.at(CETHER);
    this.feeRuleRegistry = await FeeRuleRegistry.new('0', _);
    this.proxy = await Proxy.new(
      this.registry.address,
      this.feeRuleRegistry.address
    );
  });

  beforeEach(async function () {
    id = await evmSnapshot();
    balanceUser = await tracker(user);
    balanceProxy = await tracker(this.proxy.address);
  });

  afterEach(async function () {
    await evmRevert(id);
  });

  describe('Mint', function () {
    it('normal', async function () {
      const value = ether('0.1');
      const to = this.hCEther.address;
      const data = abi.simpleEncode('mint(uint256)', value);
      const rate = await this.cEther.exchangeRateStored.call();
      const result = value.mul(ether('1')).div(rate);
      const cEtherUser = await this.cEther.balanceOf.call(user);

      const receipt = await this.proxy.execMock(to, data, {
        from: user,
        value: ether('0.1'),
      });

      // Get handler return result
      const handlerReturn = utils.toBN(
        getHandlerReturn(receipt, ['uint256'])[0]
      );
      const cEtherUserEnd = await this.cEther.balanceOf.call(user);
      expect(cEtherUserEnd.sub(cEtherUser)).to.be.bignumber.eq(handlerReturn);
      expect(
        cEtherUserEnd.sub(cEtherUser).mul(new BN('1000')).divRound(result)
      ).to.be.bignumber.eq(new BN('1000'));

      expect(await balanceUser.delta()).to.be.bignumber.eq(
        ether('0').sub(ether('0.1'))
      );

      profileGas(receipt);
    });

    it('max amount', async function () {
      const value = ether('0.1');
      const to = this.hCEther.address;
      const data = abi.simpleEncode('mint(uint256)', MAX_UINT256);
      const rate = await this.cEther.exchangeRateStored.call();
      const result = value.mul(ether('1')).div(rate);
      const cEtherUser = await this.cEther.balanceOf.call(user);

      const receipt = await this.proxy.execMock(to, data, {
        from: user,
        value: ether('0.1'),
      });

      // Get handler return result
      const handlerReturn = utils.toBN(
        getHandlerReturn(receipt, ['uint256'])[0]
      );
      const cEtherUserEnd = await this.cEther.balanceOf.call(user);
      expect(cEtherUserEnd.sub(cEtherUser)).to.be.bignumber.eq(handlerReturn);
      expect(
        cEtherUserEnd.sub(cEtherUser).mul(new BN('1000')).divRound(result)
      ).to.be.bignumber.eq(new BN('1000'));

      expect(await balanceUser.delta()).to.be.bignumber.eq(
        ether('0').sub(ether('0.1'))
      );

      profileGas(receipt);
    });
  });

  describe('Redeem', function () {
    beforeEach(async function () {
      await this.cEther.mint({
        from: user,
        value: ether('1'),
      });
      cEtherUser = await this.cEther.balanceOf.call(user);
    });

    it('normal', async function () {
      const value = cEtherUser;
      const to = this.hCEther.address;
      const data = abi.simpleEncode('redeem(uint256)', value);
      const rate = await this.cEther.exchangeRateStored.call();
      const result = value.mul(rate).div(ether('1'));
      await this.cEther.transfer(this.proxy.address, value, { from: user });
      await this.proxy.updateTokenMock(this.cEther.address);
      await balanceUser.get();

      const receipt = await this.proxy.execMock(to, data, {
        from: user,
        value: ether('0.1'),
      });

      // Get handler return result
      const handlerReturn = utils.toBN(
        getHandlerReturn(receipt, ['uint256'])[0]
      );

      const balanceDelta = await balanceUser.delta();
      expect(balanceDelta).to.be.bignumber.eq(handlerReturn);

      expect(await this.cEther.balanceOf.call(user)).to.be.bignumber.eq(
        ether('0')
      );
      expect(
        balanceDelta.mul(new BN('1000')).divRound(result)
      ).to.be.bignumber.eq(new BN('1000'));

      profileGas(receipt);
    });

    it('max amount', async function () {
      const value = cEtherUser;
      const to = this.hCEther.address;
      const data = abi.simpleEncode('redeem(uint256)', MAX_UINT256);
      const rate = await this.cEther.exchangeRateStored.call();
      const result = value.mul(rate).div(ether('1'));
      await this.cEther.transfer(this.proxy.address, value, { from: user });
      await this.proxy.updateTokenMock(this.cEther.address);
      await balanceUser.get();

      const receipt = await this.proxy.execMock(to, data, {
        from: user,
        value: ether('0.1'),
      });

      // Get handler return result
      const handlerReturn = utils.toBN(
        getHandlerReturn(receipt, ['uint256'])[0]
      );

      const balanceDelta = await balanceUser.delta();
      expect(balanceDelta).to.be.bignumber.eq(handlerReturn);

      expect(await this.cEther.balanceOf.call(user)).to.be.bignumber.eq(
        ether('0')
      );
      expect(
        balanceDelta.mul(new BN('1000')).divRound(result)
      ).to.be.bignumber.eq(new BN('1000'));

      profileGas(receipt);
    });

    it('revert', async function () {
      const value = cEtherUser;
      const to = this.hCEther.address;
      const data = abi.simpleEncode('redeem(uint256)', value);
      await this.proxy.updateTokenMock(this.cEther.address);

      await expectRevert(
        this.proxy.execMock(to, data, {
          from: user,
          value: ether('0.1'),
        }),
        'HCEther_redeem: error 9'
      );
    });
  });

  describe('Redeem Underlying', function () {
    beforeEach(async function () {
      await this.cEther.mint({
        from: user,
        value: ether('1'),
      });
      cEtherUser = await this.cEther.balanceOf.call(user);
    });

    it('normal', async function () {
      const value = ether('1');
      const to = this.hCEther.address;
      const data = abi.simpleEncode('redeemUnderlying(uint256)', value);
      const rate = await this.cEther.exchangeRateStored.call();
      const result = value.mul(ether('1')).div(rate);
      await this.cEther.transfer(this.proxy.address, cEtherUser, {
        from: user,
      });
      await this.proxy.updateTokenMock(this.cEther.address);
      await balanceUser.get();

      const receipt = await this.proxy.execMock(to, data, {
        from: user,
        value: ether('0.1'),
      });

      // Get handler return result
      const handlerReturn = utils.toBN(
        getHandlerReturn(receipt, ['uint256'])[0]
      );

      const cEtherUserAmountEnd = await this.cEther.balanceOf.call(user);
      expect(handlerReturn).to.be.bignumber.eq(
        cEtherUser.sub(cEtherUserAmountEnd)
      );

      expect(await balanceUser.delta()).to.be.bignumber.eq(value);
      expect(
        (await this.cEther.balanceOf.call(user)).sub(cEtherUser.sub(result))
      ).to.be.bignumber.lt(new BN('1000'));
      profileGas(receipt);
    });

    it('revert', async function () {
      const value = ether('1');
      const to = this.hCEther.address;
      const data = abi.simpleEncode('redeemUnderlying(uint256)', value);
      await this.proxy.updateTokenMock(this.cEther.address);
      await expectRevert(
        this.proxy.execMock(to, data, {
          from: user,
          value: ether('0.1'),
        }),
        'HCEther_redeemUnderlying: error 9'
      );
    });
  });

  describe('Repay Borrow Behalf', function () {
    let borrowAmount;
    before(async function () {
      this.comptroller = await IComptroller.at(COMPOUND_COMPTROLLER);
      this.cDai = await ICToken.at(CDAI);
      await this.comptroller.enterMarkets([CDAI], { from: user });
      this.dai = await IToken.at(DAI_TOKEN);
    });
    beforeEach(async function () {
      borrowAmount = ether('0.1');
      await this.dai.transfer(user, ether('1000'), { from: providerAddress });
      await this.dai.approve(this.cDai.address, ether('1000'), { from: user });
      await this.cDai.mint(ether('1000'), { from: user });
      await this.cEther.borrow(borrowAmount, { from: user });
    });

    it('normal', async function () {
      const value = ether('0.2');
      const to = this.hCEther.address;
      const data = abi.simpleEncode(
        'repayBorrowBehalf(uint256,address)',
        value,
        user
      );

      const receipt = await this.proxy.execMock(to, data, {
        from: user,
        value: value,
      });

      // Get handler return result
      const handlerReturn = utils.toBN(
        getHandlerReturn(receipt, ['uint256'])[0]
      );

      expect(
        await this.cEther.borrowBalanceCurrent.call(user)
      ).to.be.bignumber.eq(handlerReturn);

      expect(
        await this.cEther.borrowBalanceCurrent.call(user)
      ).to.be.bignumber.eq(ether('0'));
      profileGas(receipt);
    });

    it('partial', async function () {
      const value = borrowAmount.div(new BN(2));
      const remainBorrowAmount = borrowAmount.sub(value);
      const to = this.hCEther.address;
      const data = abi.simpleEncode(
        'repayBorrowBehalf(uint256,address)',
        value,
        user
      );

      const receipt = await this.proxy.execMock(to, data, {
        from: user,
        value: value,
      });

      // Get handler return result
      const handlerReturn = utils.toBN(
        getHandlerReturn(receipt, ['uint256'])[0]
      );

      expect(
        await this.cEther.borrowBalanceCurrent.call(user)
      ).to.be.bignumber.eq(handlerReturn);
      expectEqWithinBps(
        await this.cEther.borrowBalanceCurrent.call(user),
        remainBorrowAmount
      );

      profileGas(receipt);
    });

    it('insufficient ether', async function () {
      const value = ether('0.2');
      const to = this.hCEther.address;
      const data = abi.simpleEncode(
        'repayBorrowBehalf(uint256,address)',
        value,
        user
      );
      await expectRevert(
        this.proxy.execMock(to, data, {
          from: user,
          value: ether('0.09'),
        }),
        'HCEther_repayBorrowBehalf: Unspecified'
      );
    });
  });
});
