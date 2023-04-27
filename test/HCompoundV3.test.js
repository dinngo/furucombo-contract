const chainId = network.config.chainId;

if (chainId == 1 || chainId == 137) {
  // This test supports to run on these chains.
} else {
  return;
}

const {
  balance,
  BN,
  ether,
  constants,
  expectRevert,
} = require('@openzeppelin/test-helpers');
const { MAX_UINT256 } = constants;
const { tracker } = balance;
const abi = require('ethereumjs-abi');
const utils = web3.utils;

const { expect } = require('chai');

const {
  WBTC_TOKEN,
  DAI_TOKEN,
  USDC_TOKEN,
  WRAPPED_NATIVE_TOKEN,
  CBETH_TOKEN,
  COMPOUND_V3_COMET_USDC,
  COMPOUND_V3_COMET_WETH,
} = require('./utils/constants');
const {
  evmRevert,
  evmSnapshot,
  profileGas,
  getHandlerReturn,
  expectEqWithinBps,
  setTokenBalance,
  mwei,
} = require('./utils/utils');

const HCompoundV3 = artifacts.require('HCompoundV3');
const FeeRuleRegistry = artifacts.require('FeeRuleRegistry');
const Registry = artifacts.require('Registry');
const Proxy = artifacts.require('ProxyMock');
const IComet = artifacts.require('IComet');
const IToken = artifacts.require('IERC20');

contract('Compound V3', function ([_, user, someone]) {
  let id;
  let balanceUser;
  let balanceProxy;

  before(async function () {
    this.feeRuleRegistry = await FeeRuleRegistry.new('0', _);
    this.registry = await Registry.new();
    this.proxy = await Proxy.new(
      this.registry.address,
      this.feeRuleRegistry.address
    );
    this.hCompoundV3 = await HCompoundV3.new(WRAPPED_NATIVE_TOKEN);
    await this.registry.register(
      this.hCompoundV3.address,
      utils.asciiToHex('CompoundV3')
    );

    this.cometUSDC = await IComet.at(COMPOUND_V3_COMET_USDC);
    this.USDC = await IToken.at(USDC_TOKEN);
    this.DAI = await IToken.at(DAI_TOKEN);
    this.WBTC = await IToken.at(WBTC_TOKEN);
    this.wrappedNativeToken = await IToken.at(WRAPPED_NATIVE_TOKEN);

    // Ethereum only
    if (chainId == 1) {
      this.cometWETH = await IComet.at(COMPOUND_V3_COMET_WETH);
      this.cbETH = await IToken.at(CBETH_TOKEN);
    }
  });

  beforeEach(async function () {
    id = await evmSnapshot();
    balanceUser = await tracker(user);
    balanceProxy = await tracker(this.proxy.address);
  });

  afterEach(async function () {
    await evmRevert(id);
  });

  describe('Supply', function () {
    describe('ETH-collateral', function () {
      const supplyAmount = ether('1');

      it('normal', async function () {
        const collateral = this.wrappedNativeToken;
        const value = supplyAmount;
        const comet = this.cometUSDC;
        const to = this.hCompoundV3.address;
        const data = abi.simpleEncode(
          'supplyETH(address,address,uint256)',
          comet.address,
          user,
          value
        );

        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: value,
        });

        // Verify supply
        expect(
          await comet.collateralBalanceOf(user, collateral.address)
        ).to.be.bignumber.eq(value);

        // Verify proxy balance
        expect(await balanceProxy.get()).to.be.bignumber.zero;

        // Verify user balance
        expect(await balanceUser.delta()).to.be.bignumber.eq(
          ether('0').sub(value)
        );
        profileGas(receipt);
      });

      it('max amount', async function () {
        const collateral = this.wrappedNativeToken;
        const value = supplyAmount;
        const comet = this.cometUSDC;
        const to = this.hCompoundV3.address;
        const data = abi.simpleEncode(
          'supplyETH(address,address,uint256)',
          comet.address,
          user,
          MAX_UINT256
        );

        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: value,
        });

        // Verify supply
        expect(
          await comet.collateralBalanceOf(user, collateral.address)
        ).to.be.bignumber.eq(value);

        // Verify proxy balance
        expect(await balanceProxy.get()).to.be.bignumber.zero;

        // Verify user balance
        expect(await balanceUser.delta()).to.be.bignumber.eq(
          ether('0').sub(value)
        );
        profileGas(receipt);
      });
    });

    describe('ETH-base', function () {
      // Ethereum only
      if (chainId != 1) {
        return;
      }

      const supplyAmount = ether('1');

      it('normal', async function () {
        const baseToken = this.wrappedNativeToken;
        const value = supplyAmount;
        const comet = this.cometWETH;
        const to = this.hCompoundV3.address;
        const data = abi.simpleEncode(
          'supplyETH(address,address,uint256)',
          comet.address,
          user,
          value
        );

        const beforeBalance = await baseToken.balanceOf(comet.address);

        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: value,
        });

        // Verify supply
        expect(await baseToken.balanceOf(comet.address)).to.be.bignumber.eq(
          beforeBalance.add(value)
        );

        // Verify proxy balance
        expect(await balanceProxy.get()).to.be.bignumber.zero;

        // Verify user balance
        expect(await balanceUser.delta()).to.be.bignumber.eq(
          ether('0').sub(value)
        );
        profileGas(receipt);
      });

      it('max amount', async function () {
        const baseToken = this.wrappedNativeToken;
        const value = supplyAmount;
        const comet = this.cometWETH;
        const to = this.hCompoundV3.address;
        const data = abi.simpleEncode(
          'supplyETH(address,address,uint256)',
          comet.address,
          user,
          MAX_UINT256
        );

        const beforeBalance = await baseToken.balanceOf(comet.address);

        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: value,
        });

        // Verify supply
        expect(await baseToken.balanceOf(comet.address)).to.be.bignumber.eq(
          beforeBalance.add(value)
        );

        // Verify proxy balance
        expect(await balanceProxy.get()).to.be.bignumber.zero;

        // Verify user balance
        expect(await balanceUser.delta()).to.be.bignumber.eq(
          ether('0').sub(value)
        );
        profileGas(receipt);
      });
    });

    describe('Token-collateral', function () {
      const supplyAmount = ether('10');

      beforeEach(async function () {
        const collateral = this.wrappedNativeToken;
        const collateralBalanceSlotNum = 3;

        await setTokenBalance(
          collateral.address,
          this.proxy.address,
          supplyAmount,
          collateralBalanceSlotNum
        );

        await this.proxy.updateTokenMock(collateral.address);
      });

      it('normal', async function () {
        const collateral = this.wrappedNativeToken;
        const value = supplyAmount;
        const comet = this.cometUSDC;
        const to = this.hCompoundV3.address;
        const data = abi.simpleEncode(
          'supply(address,address,address,uint256)',
          comet.address,
          user,
          collateral.address,
          value
        );

        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: ether('0.1'),
        });

        // Verify supply
        expect(
          await comet.collateralBalanceOf(user, collateral.address)
        ).to.be.bignumber.eq(value);

        // Verify proxy balance
        expect(await balanceProxy.get()).to.be.bignumber.zero;

        // Verify user balance
        expect(await balanceUser.delta()).to.be.bignumber.zero;
        profileGas(receipt);
      });

      it('max amount', async function () {
        const collateral = this.wrappedNativeToken;
        const value = supplyAmount;
        const comet = this.cometUSDC;
        const to = this.hCompoundV3.address;
        const data = abi.simpleEncode(
          'supply(address,address,address,uint256)',
          comet.address,
          user,
          collateral.address,
          MAX_UINT256
        );

        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: ether('0.1'),
        });

        // Verify supply
        expect(
          await comet.collateralBalanceOf(user, collateral.address)
        ).to.be.bignumber.eq(value);

        // Verify proxy balance
        expect(await balanceProxy.get()).to.be.bignumber.zero;

        // Verify user balance
        expect(await balanceUser.delta()).to.be.bignumber.zero;
        profileGas(receipt);
      });

      it('should revert: unsupported collateral', async function () {
        const collateral = this.DAI;
        const value = supplyAmount;
        const comet = this.cometUSDC;
        const to = this.hCompoundV3.address;
        const data = abi.simpleEncode(
          'supply(address,address,address,uint256)',
          comet.address,
          user,
          collateral.address,
          value
        );

        await expectRevert.unspecified(
          this.proxy.execMock(to, data, {
            from: user,
            value: ether('0.1'),
          })
        );
      });
    });

    describe('Token-base', function () {
      const supplyAmount = ether('10');

      beforeEach(async function () {
        const baseToken = this.USDC;
        const baseTokenBalanceSlotNum = chainId == 1 ? 9 : 0;

        await setTokenBalance(
          baseToken.address,
          this.proxy.address,
          supplyAmount,
          baseTokenBalanceSlotNum
        );

        await this.proxy.updateTokenMock(baseToken.address);
      });

      it('normal', async function () {
        const baseToken = this.USDC;
        const value = supplyAmount;
        const comet = this.cometUSDC;
        const to = this.hCompoundV3.address;
        const data = abi.simpleEncode(
          'supply(address,address,address,uint256)',
          comet.address,
          user,
          baseToken.address,
          value
        );

        const beforeBalance = await baseToken.balanceOf(comet.address);

        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: ether('0.1'),
        });

        // Verify supply
        expect(await baseToken.balanceOf(comet.address)).to.be.bignumber.eq(
          beforeBalance.add(value)
        );

        // Verify proxy balance
        expect(await balanceProxy.get()).to.be.bignumber.zero;

        // Verify user balance
        expect(await balanceUser.delta()).to.be.bignumber.zero;
        profileGas(receipt);
      });

      it('max amount', async function () {
        const baseToken = this.USDC;
        const value = supplyAmount;
        const comet = this.cometUSDC;
        const to = this.hCompoundV3.address;
        const data = abi.simpleEncode(
          'supply(address,address,address,uint256)',
          comet.address,
          user,
          baseToken.address,
          MAX_UINT256
        );

        const beforeBalance = await baseToken.balanceOf(comet.address);

        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: ether('0.1'),
        });

        // Verify supply
        expect(await baseToken.balanceOf(comet.address)).to.be.bignumber.eq(
          beforeBalance.add(value)
        );

        // Verify proxy balance
        expect(await balanceProxy.get()).to.be.bignumber.zero;

        // Verify user balance
        expect(await balanceUser.delta()).to.be.bignumber.zero;
        profileGas(receipt);
      });
    });
  });

  describe('Withdraw', function () {
    const supplyAmount = ether('1');

    describe('ETH-collateral', function () {
      // Ethereum only
      if (chainId != 1) {
        return;
      }

      beforeEach(async function () {
        const collateral = this.wrappedNativeToken;
        const collateralBalanceSlotNum = 3;
        const comet = this.cometUSDC;

        await setTokenBalance(
          collateral.address,
          user,
          supplyAmount,
          collateralBalanceSlotNum
        );

        await collateral.approve(comet.address, supplyAmount, {
          from: user,
        });

        await comet.supply(collateral.address, supplyAmount, {
          from: user,
        });

        // Allow proxy to move funds
        await comet.allow(this.proxy.address, true, {
          from: user,
        });
      });

      it('normal', async function () {
        const collateral = this.wrappedNativeToken;
        const value = supplyAmount;
        const comet = this.cometUSDC;
        const to = this.hCompoundV3.address;
        const data = abi.simpleEncode(
          'withdrawETH(address,address,uint256)',
          comet.address,
          user,
          value
        );

        await balanceUser.get();

        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: ether('0.1'),
        });

        // Get handler return result
        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );

        // Verify handler return
        expect(value).to.be.bignumber.eq(handlerReturn);

        // Verify proxy balance
        expect(await balanceProxy.delta()).to.be.bignumber.zero;

        // Verify user balance
        expect(await balanceUser.delta()).to.be.bignumber.eq(value);

        // Verify user collateral balance
        expect(
          await comet.collateralBalanceOf(user, collateral.address)
        ).to.be.bignumber.eq(supplyAmount.sub(value));
        profileGas(receipt);
      });

      it('partial', async function () {
        const collateral = this.wrappedNativeToken;
        const value = supplyAmount.div(new BN(2));
        const comet = this.cometUSDC;
        const to = this.hCompoundV3.address;
        const data = abi.simpleEncode(
          'withdrawETH(address,address,uint256)',
          comet.address,
          user,
          value
        );

        await balanceUser.get();

        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: ether('0.1'),
        });

        // Get handler return result
        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );

        // Verify handler return
        expect(value).to.be.bignumber.eq(handlerReturn);

        // Verify proxy balance
        expect(await balanceProxy.delta()).to.be.bignumber.zero;

        // Verify user balance
        expect(await balanceUser.delta()).to.be.bignumber.eq(value);

        // Verify user collateral balance
        expect(
          await comet.collateralBalanceOf(user, collateral.address)
        ).to.be.bignumber.eq(supplyAmount.sub(value));
        profileGas(receipt);
      });

      it('should revert: not enough balance', async function () {
        const value = supplyAmount.mul(new BN(2));
        const comet = this.cometUSDC;
        const to = this.hCompoundV3.address;
        const data = abi.simpleEncode(
          'withdrawETH(address,address,uint256)',
          comet.address,
          user,
          value
        );

        await balanceUser.get();

        await expectRevert.unspecified(
          this.proxy.execMock(to, data, {
            from: user,
            value: ether('0.1'),
          })
        );
      });

      it('should revert: disallowed', async function () {
        const value = supplyAmount;
        const comet = this.cometUSDC;
        const to = this.hCompoundV3.address;
        const data = abi.simpleEncode(
          'withdrawETH(address,address,uint256)',
          comet.address,
          user,
          value
        );

        // Disallow proxy to move funds
        await comet.allow(this.proxy.address, false, {
          from: user,
        });

        await expectRevert.unspecified(
          this.proxy.execMock(to, data, {
            from: user,
            value: ether('0.1'),
          })
        );
      });
    });

    describe('ETH-base', function () {
      // Ethereum only
      if (chainId != 1) {
        return;
      }

      beforeEach(async function () {
        const baseToken = this.wrappedNativeToken;
        const baseTokenBalanceSlotNum = 3;
        const comet = this.cometWETH;

        await setTokenBalance(
          baseToken.address,
          user,
          supplyAmount,
          baseTokenBalanceSlotNum
        );

        await baseToken.approve(comet.address, supplyAmount, {
          from: user,
        });

        await comet.supply(baseToken.address, supplyAmount, {
          from: user,
        });

        // Allow proxy to move funds
        await comet.allow(this.proxy.address, true, {
          from: user,
        });
      });

      it('normal', async function () {
        const value = supplyAmount;
        const comet = this.cometWETH;
        const to = this.hCompoundV3.address;
        const data = abi.simpleEncode(
          'withdrawETH(address,address,uint256)',
          comet.address,
          user,
          value
        );

        await balanceUser.get();

        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: ether('0.1'),
        });

        // Get handler return result
        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );

        // Verify handler return
        expect(value).to.be.bignumber.eq(handlerReturn);

        // Verify proxy balance
        expect(await balanceProxy.delta()).to.be.bignumber.zero;

        // Verify user balance
        expect(await balanceUser.delta()).to.be.bignumber.eq(value);
        profileGas(receipt);
      });

      it('partial', async function () {
        const value = supplyAmount.div(new BN(2));
        const comet = this.cometWETH;
        const to = this.hCompoundV3.address;
        const data = abi.simpleEncode(
          'withdrawETH(address,address,uint256)',
          comet.address,
          user,
          value
        );

        await balanceUser.get();

        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: ether('0.1'),
        });

        // Get handler return result
        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );

        // Verify handler return
        expect(value).to.be.bignumber.eq(handlerReturn);

        // Verify proxy balance
        expect(await balanceProxy.delta()).to.be.bignumber.zero;

        // Verify user balance
        expect(await balanceUser.delta()).to.be.bignumber.eq(value);
        profileGas(receipt);
      });

      it('should revert: not enough balance', async function () {
        const value = supplyAmount.mul(new BN(2));
        const comet = this.cometWETH;
        const to = this.hCompoundV3.address;
        const data = abi.simpleEncode(
          'withdrawETH(address,address,uint256)',
          comet.address,
          user,
          value
        );

        await expectRevert.unspecified(
          this.proxy.execMock(to, data, {
            from: user,
            value: ether('0.1'),
          })
        );
      });

      it('should revert: disallowed', async function () {
        const value = supplyAmount;
        const comet = this.cometWETH;
        const to = this.hCompoundV3.address;
        const data = abi.simpleEncode(
          'withdrawETH(address,address,uint256)',
          comet.address,
          user,
          value
        );

        // Disallow proxy to move funds
        await comet.allow(this.proxy.address, false, {
          from: user,
        });

        await expectRevert.unspecified(
          this.proxy.execMock(to, data, {
            from: user,
            value: ether('0.1'),
          })
        );
      });
    });

    describe('Token-collateral', function () {
      beforeEach(async function () {
        const collateral = this.wrappedNativeToken;
        const collateralBalanceSlotNum = 3;
        const comet = this.cometUSDC;

        await setTokenBalance(
          collateral.address,
          user,
          supplyAmount,
          collateralBalanceSlotNum
        );

        await collateral.approve(comet.address, supplyAmount, {
          from: user,
        });

        await comet.supply(collateral.address, supplyAmount, {
          from: user,
        });

        // Allow proxy to move funds
        await comet.allow(this.proxy.address, true, {
          from: user,
        });
      });

      it('normal', async function () {
        const collateral = this.wrappedNativeToken;
        const value = supplyAmount;
        const comet = this.cometUSDC;
        const to = this.hCompoundV3.address;
        const data = abi.simpleEncode(
          'withdraw(address,address,address,uint256)',
          comet.address,
          user,
          collateral.address,
          value
        );

        await balanceUser.get();

        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: ether('0.1'),
        });

        // Get handler return result
        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );

        // Verify handler return
        expect(value).to.be.bignumber.eq(handlerReturn);

        // Verify proxy balance
        expect(await balanceProxy.delta()).to.be.bignumber.zero;

        // Verify user balance
        expect(await collateral.balanceOf(user)).to.be.bignumber.eq(value);
        expect(await balanceUser.delta()).to.be.bignumber.zero;

        // Verify user collateral balance
        expect(
          await comet.collateralBalanceOf(user, collateral.address)
        ).to.be.bignumber.zero;
        profileGas(receipt);
      });

      it('partial', async function () {
        const collateral = this.wrappedNativeToken;
        const value = supplyAmount.div(new BN(2));
        const comet = this.cometUSDC;
        const to = this.hCompoundV3.address;
        const data = abi.simpleEncode(
          'withdraw(address,address,address,uint256)',
          comet.address,
          user,
          collateral.address,
          value
        );

        await balanceUser.get();

        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: ether('0.1'),
        });

        // Get handler return result
        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );

        // Verify handler return
        expect(value).to.be.bignumber.eq(handlerReturn);

        // Verify proxy balance
        expect(await balanceProxy.delta()).to.be.bignumber.zero;

        // Verify user balance
        expect(await collateral.balanceOf(user)).to.be.bignumber.eq(value);
        expect(await balanceUser.delta()).to.be.bignumber.zero;

        // Verify user collateral balance
        expect(
          await comet.collateralBalanceOf(user, collateral.address)
        ).to.be.bignumber.eq(supplyAmount.sub(value));
        profileGas(receipt);
      });

      it('should revert: not enough balance', async function () {
        const collateral = this.WBTC;
        const value = supplyAmount;
        const comet = this.cometUSDC;
        const to = this.hCompoundV3.address;
        const data = abi.simpleEncode(
          'withdraw(address,address,address,uint256)',
          comet.address,
          user,
          collateral.address,
          value
        );

        await expectRevert.unspecified(
          this.proxy.execMock(to, data, {
            from: user,
            value: ether('0.1'),
          })
        );
      });

      it('should revert: unsupported collateral', async function () {
        const collateral = this.DAI;
        const value = supplyAmount;
        const comet = this.cometUSDC;
        const to = this.hCompoundV3.address;
        const data = abi.simpleEncode(
          'withdraw(address,address,address,uint256)',
          comet.address,
          user,
          collateral.address,
          value
        );

        await expectRevert.unspecified(
          this.proxy.execMock(to, data, {
            from: user,
            value: ether('0.1'),
          })
        );
      });

      it('should revert: disallowed', async function () {
        const collateral = this.wrappedNativeToken;
        const value = supplyAmount;
        const comet = this.cometUSDC;
        const to = this.hCompoundV3.address;
        const data = abi.simpleEncode(
          'withdraw(address,address,address,uint256)',
          comet.address,
          user,
          collateral.address,
          value
        );

        // Disallow proxy to move funds
        await comet.allow(this.proxy.address, false, {
          from: user,
        });

        await expectRevert.unspecified(
          this.proxy.execMock(to, data, {
            from: user,
            value: ether('0.1'),
          })
        );
      });
    });

    describe('Token-base', function () {
      beforeEach(async function () {
        const baseToken = this.USDC;
        const baseTokenBalanceSlotNum = chainId == 1 ? 9 : 0;
        const comet = this.cometUSDC;

        await setTokenBalance(
          baseToken.address,
          user,
          supplyAmount,
          baseTokenBalanceSlotNum
        );

        await baseToken.approve(comet.address, supplyAmount, {
          from: user,
        });

        await comet.supply(baseToken.address, supplyAmount, {
          from: user,
        });

        // Allow proxy to move funds
        await comet.allow(this.proxy.address, true, {
          from: user,
        });
      });

      it('normal', async function () {
        const baseToken = this.USDC;
        const value = supplyAmount;
        const comet = this.cometUSDC;
        const to = this.hCompoundV3.address;
        const data = abi.simpleEncode(
          'withdraw(address,address,address,uint256)',
          comet.address,
          user,
          baseToken.address,
          value
        );

        await balanceUser.get();

        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: ether('0.1'),
        });

        // Get handler return result
        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );

        // Verify handler return
        expect(value).to.be.bignumber.eq(handlerReturn);

        // Verify proxy balance
        expect(await balanceProxy.delta()).to.be.bignumber.zero;

        // Verify user balance
        expect(await baseToken.balanceOf(user)).to.be.bignumber.eq(value);
        expect(await balanceUser.delta()).to.be.bignumber.zero;
        profileGas(receipt);
      });

      it('partial', async function () {
        const baseToken = this.USDC;
        const value = supplyAmount.div(new BN(2));
        const comet = this.cometUSDC;
        const to = this.hCompoundV3.address;
        const data = abi.simpleEncode(
          'withdraw(address,address,address,uint256)',
          comet.address,
          user,
          baseToken.address,
          value
        );

        await balanceUser.get();

        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: ether('0.1'),
        });

        // Get handler return result
        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );

        // Verify handler return
        expect(value).to.be.bignumber.eq(handlerReturn);

        // Verify proxy balance
        expect(await balanceProxy.delta()).to.be.bignumber.zero;

        // Verify user balance
        expect(await baseToken.balanceOf(user)).to.be.bignumber.eq(value);
        expect(await balanceUser.delta()).to.be.bignumber.zero;
        profileGas(receipt);
      });

      it('should revert: not enough balance', async function () {
        const baseToken = this.USDC;
        const value = supplyAmount.mul(new BN(2));
        const comet = this.cometUSDC;
        const to = this.hCompoundV3.address;
        const data = abi.simpleEncode(
          'withdraw(address,address,address,uint256)',
          comet.address,
          user,
          baseToken.address,
          value
        );

        await expectRevert.unspecified(
          this.proxy.execMock(to, data, {
            from: user,
            value: ether('0.1'),
          })
        );
      });

      it('should revert: disallowed', async function () {
        const baseToken = this.USDC;
        const value = supplyAmount;
        const comet = this.cometUSDC;
        const to = this.hCompoundV3.address;
        const data = abi.simpleEncode(
          'withdraw(address,address,address,uint256)',
          comet.address,
          user,
          baseToken.address,
          value
        );

        // Disallow proxy to move funds
        await comet.allow(this.proxy.address, false, {
          from: user,
        });

        await expectRevert.unspecified(
          this.proxy.execMock(to, data, {
            from: user,
            value: ether('0.1'),
          })
        );
      });
    });
  });

  describe('Borrow', function () {
    const supplyAmount = ether('2000');

    describe('ETH', function () {
      // Ethereum only
      if (chainId != 1) {
        return;
      }
      beforeEach(async function () {
        // Supply WETH comet
        const collateral = this.cbETH;
        const collateralBalanceSlotNum = 9;
        const comet = this.cometWETH;

        await setTokenBalance(
          collateral.address,
          user,
          supplyAmount,
          collateralBalanceSlotNum
        );

        await collateral.approve(comet.address, supplyAmount, {
          from: user,
        });

        await comet.supply(collateral.address, supplyAmount, {
          from: user,
        });

        expect(
          await comet.collateralBalanceOf(user, collateral.address)
        ).to.be.bignumber.eq(supplyAmount);

        // Permit proxy to move funds
        await comet.allow(this.proxy.address, true, {
          from: user,
        });
      });

      it('normal', async function () {
        const value = supplyAmount.div(new BN(2)); // 50%
        const comet = this.cometWETH;
        const to = this.hCompoundV3.address;
        const data = abi.simpleEncode(
          'withdrawETH(address,address,uint256)',
          comet.address,
          user,
          value
        );

        await balanceUser.get();

        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: ether('0.1'),
        });

        // Get handler return result
        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );

        // Verify handler return
        expect(value).to.be.bignumber.eq(handlerReturn);

        // Verify proxy balance
        expect(await balanceProxy.delta()).to.be.bignumber.zero;

        // Verify user balance
        expect(await balanceUser.delta()).to.be.bignumber.eq(value);
        profileGas(receipt);
      });

      it('should revert: less than borrow min', async function () {
        const comet = this.cometWETH;
        const value = (await comet.baseBorrowMin()).sub(new BN(1));
        const to = this.hCompoundV3.address;
        const data = abi.simpleEncode(
          'withdrawETH(address,address,uint256)',
          comet.address,
          user,
          value
        );

        await expectRevert.unspecified(
          this.proxy.execMock(to, data, {
            from: user,
            value: ether('0.1'),
          })
        );
      });

      it('should revert: borrow token over collateral value', async function () {
        const value = supplyAmount.add(new BN(1));
        const comet = this.cometWETH;
        const to = this.hCompoundV3.address;
        const data = abi.simpleEncode(
          'withdrawETH(address,address,uint256)',
          comet.address,
          user,
          value
        );

        await expectRevert.unspecified(
          this.proxy.execMock(to, data, {
            from: user,
            value: ether('0.1'),
          })
        );
      });
    });

    describe('Token', function () {
      beforeEach(async function () {
        // Supply token comet
        const comet = this.cometUSDC;
        const collateral = this.wrappedNativeToken;
        const collateralBalanceSlotNum = 3;

        await setTokenBalance(
          collateral.address,
          user,
          supplyAmount,
          collateralBalanceSlotNum
        );

        await collateral.approve(comet.address, supplyAmount, {
          from: user,
        });

        await comet.supply(collateral.address, supplyAmount, {
          from: user,
        });

        expect(
          await comet.collateralBalanceOf(user, collateral.address)
        ).to.be.bignumber.eq(supplyAmount);

        // Permit proxy to move funds
        await comet.allow(this.proxy.address, true, {
          from: user,
        });
      });

      it('normal', async function () {
        const asset = this.USDC;
        const value = mwei('1000'); // 50%
        const comet = this.cometUSDC;
        const to = this.hCompoundV3.address;
        const data = abi.simpleEncode(
          'withdraw(address,address,address,uint256)',
          comet.address,
          user,
          asset.address,
          value
        );

        await balanceUser.get();

        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: ether('0.1'),
        });

        // Get handler return result
        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );

        // Verify handler return
        expect(value).to.be.bignumber.eq(handlerReturn);

        // Verify proxy balance
        expect(await balanceProxy.delta()).to.be.bignumber.zero;

        // Verify user balance
        expect(await asset.balanceOf(user)).to.be.bignumber.eq(value);
        expect(await balanceUser.delta()).to.be.bignumber.zero;
        profileGas(receipt);
      });

      it('should revert: less than borrow min', async function () {
        const asset = this.USDC;
        const comet = this.cometUSDC;
        const value = (await comet.baseBorrowMin()).sub(new BN(1));
        const to = this.hCompoundV3.address;
        const data = abi.simpleEncode(
          'withdraw(address,address,address,uint256)',
          comet.address,
          user,
          asset.address,
          value
        );

        await expectRevert.unspecified(
          this.proxy.execMock(to, data, {
            from: user,
            value: ether('0.1'),
          })
        );
      });

      it('should revert: borrow token over collateral value', async function () {
        const asset = this.USDC;
        const value = supplyAmount;
        const comet = this.cometUSDC;
        const to = this.hCompoundV3.address;
        const data = abi.simpleEncode(
          'withdraw(address,address,address,uint256)',
          comet.address,
          user,
          asset.address,
          value
        );

        await expectRevert.unspecified(
          this.proxy.execMock(to, data, {
            from: user,
            value: ether('0.1'),
          })
        );
      });
    });
  });

  describe('Repay', function () {
    const supplyAmount = ether('2000');

    describe('ETH', function () {
      // Ethereum only
      if (chainId != 1) {
        return;
      }
      const borrowAmount = supplyAmount.div(new BN(2));

      beforeEach(async function () {
        // Supply WETH comet
        const collateral = this.cbETH;
        const collateralBalanceSlotNum = 9;
        const asset = this.wrappedNativeToken;
        const comet = this.cometWETH;

        await setTokenBalance(
          collateral.address,
          user,
          supplyAmount,
          collateralBalanceSlotNum
        );

        await collateral.approve(comet.address, supplyAmount, {
          from: user,
        });

        await comet.supply(collateral.address, supplyAmount, {
          from: user,
        });

        expect(
          await comet.collateralBalanceOf(user, collateral.address)
        ).to.be.bignumber.eq(supplyAmount);

        // Borrow WETH
        await comet.withdraw(asset.address, borrowAmount, {
          from: user,
        });

        expect(await asset.balanceOf(user)).to.be.bignumber.eq(borrowAmount);

        // Permit proxy to move funds
        await comet.allow(this.proxy.address, true, {
          from: user,
        });
      });

      it('partial', async function () {
        const value = borrowAmount.div(new BN(2));
        const comet = this.cometWETH;
        const to = this.hCompoundV3.address;
        const data = abi.simpleEncode(
          'supplyETH(address,address,uint256)',
          comet.address,
          user,
          value
        );

        await balanceUser.get();
        const debtBefore = await comet.borrowBalanceOf(user);

        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: value,
        });

        // Verify repay
        const debtAfter = await comet.borrowBalanceOf(user);
        expectEqWithinBps(debtBefore.sub(debtAfter), value, 1);

        // Verify proxy balance
        expect(await balanceProxy.delta()).to.be.bignumber.zero;

        // Verify user balance
        expect(await balanceUser.delta()).to.be.bignumber.eq(
          ether('0').sub(value)
        );
        profileGas(receipt);
      });

      it('repay and supply', async function () {
        const value = borrowAmount.mul(new BN(2));
        const comet = this.cometWETH;
        const to = this.hCompoundV3.address;
        const data = abi.simpleEncode(
          'supplyETH(address,address,uint256)',
          comet.address,
          user,
          value
        );

        await balanceUser.get();

        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: value,
        });

        // Verify repay
        expect(await comet.borrowBalanceOf(user)).to.be.bignumber.zero;

        // Verify proxy balance
        expect(await balanceProxy.delta()).to.be.bignumber.zero;

        // Verify user balance
        expect(await balanceUser.delta()).to.be.bignumber.eq(
          ether('0').sub(value)
        );
        profileGas(receipt);
      });
    });

    describe('Token', function () {
      const initAmount = mwei('2000');
      const borrowAmount = mwei('1000');

      beforeEach(async function () {
        // Supply token comet
        const collateral = this.wrappedNativeToken;
        const collateralBalanceSlotNum = 3;
        const baseToken = this.USDC;
        const baseTokenBalanceSlotNum = chainId == 1 ? 9 : 0;
        const comet = this.cometUSDC;

        // Set user collateral balance
        await setTokenBalance(
          collateral.address,
          user,
          supplyAmount,
          collateralBalanceSlotNum
        );

        // Set user baseToken balance
        await setTokenBalance(
          baseToken.address,
          user,
          initAmount,
          baseTokenBalanceSlotNum
        );

        await collateral.approve(comet.address, supplyAmount, {
          from: user,
        });

        await comet.supply(collateral.address, supplyAmount, {
          from: user,
        });

        expect(
          await comet.collateralBalanceOf(user, collateral.address)
        ).to.be.bignumber.eq(supplyAmount);

        // Borrow Token
        await comet.withdraw(baseToken.address, borrowAmount, {
          from: user,
        });

        expect(await baseToken.balanceOf(user)).to.be.bignumber.eq(
          initAmount.add(borrowAmount)
        );

        // Permit proxy to move funds
        await comet.allow(this.proxy.address, true, {
          from: user,
        });
      });

      it('partial', async function () {
        const value = borrowAmount.div(new BN(2));
        const comet = this.cometUSDC;
        const baseToken = this.USDC;
        const to = this.hCompoundV3.address;
        const data = abi.simpleEncode(
          'supply(address,address,address,uint256)',
          comet.address,
          user,
          baseToken.address,
          value
        );

        // Transfer base token to proxy to repay
        await baseToken.transfer(this.proxy.address, value, { from: user });
        await this.proxy.updateTokenMock(baseToken.address);

        await balanceUser.get();
        const debtBefore = await comet.borrowBalanceOf(user);

        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: ether('0.1'),
        });

        // Verify repay
        const debtAfter = await comet.borrowBalanceOf(user);
        expectEqWithinBps(debtBefore.sub(debtAfter), value, 1);

        // Verify proxy balance
        expect(await balanceProxy.delta()).to.be.bignumber.zero;

        // Verify user balance
        expect(await baseToken.balanceOf(user)).to.be.bignumber.eq(
          initAmount.add(borrowAmount).sub(value)
        );
        expect(await balanceUser.delta()).to.be.bignumber.zero;
        profileGas(receipt);
      });

      it('repay and supply', async function () {
        const value = borrowAmount.mul(new BN(2));
        const comet = this.cometUSDC;
        const baseToken = this.USDC;
        const to = this.hCompoundV3.address;
        const data = abi.simpleEncode(
          'supply(address,address,address,uint256)',
          comet.address,
          user,
          baseToken.address,
          value
        );

        // Transfer repay token to proxy
        await baseToken.transfer(this.proxy.address, value, { from: user });
        await this.proxy.updateTokenMock(baseToken.address);

        await balanceUser.get();

        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: ether('0.1'),
        });

        // Verify repay
        expect(await comet.borrowBalanceOf(user)).to.be.bignumber.zero;

        // Verify proxy balance
        expect(await balanceProxy.delta()).to.be.bignumber.zero;

        // Verify user balance
        expect(await baseToken.balanceOf(user)).to.be.bignumber.eq(
          initAmount.add(borrowAmount).sub(value)
        );
        expect(await balanceUser.delta()).to.be.bignumber.zero;
        profileGas(receipt);
      });
    });
  });
});
