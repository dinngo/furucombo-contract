const chainId = network.config.chainId;

if (
  chainId == 1 ||
  chainId == 10 ||
  chainId == 137 ||
  chainId == 42161 ||
  chainId == 43114
) {
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
  expectEvent,
} = require('@openzeppelin/test-helpers');
const { MAX_UINT256 } = constants;
const { tracker } = balance;
const abi = require('ethereumjs-abi');
const utils = web3.utils;

const { expect } = require('chai');

const {
  USDC_TOKEN,
  WRAPPED_NATIVE_TOKEN,
  STARGATE_FACTORY,
  STARGATE_ROUTER,
  STARGATE_ROUTER_ETH,
  STARGATE_WIDGET_SWAP,
  STARGATE_DESTINATION_CHAIN_ID,
  STARGATE_VAULT_ETH,
  STARGATE_POOL_USDC,
  STARGATE_UNSUPPORT_ETH_DEST_CHAIN_ID,
  STARGATE_USDC_TO_DISALLOW_TOKEN_ID,
  STARGATE_PARTNER_ID,
  STG_TOKEN,
  LAYERZERO_ENDPOINT,
  STARGATE_MULTISIG,
} = require('./utils/constants');
const {
  evmRevert,
  evmSnapshot,
  profileGas,
  getTokenProvider,
  mwei,
  setTokenBalance,
  impersonateAndInjectEther,
} = require('./utils/utils');

const HStargate = artifacts.require('HStargate');
const FeeRuleRegistry = artifacts.require('FeeRuleRegistry');
const Registry = artifacts.require('Registry');
const Proxy = artifacts.require('ProxyMock');
const IToken = artifacts.require('IERC20');
const ILayerZeroEndpoint = artifacts.require('ILayerZeroEndpoint');
const IStargateToken = artifacts.require('IStargateToken');
const IStartgateRouter = artifacts.require('IStargateRouter');
const IStargateWidget = artifacts.require('IStargateWidget');
const IStargateFactory = artifacts.require('IFactory');

const TYPE_SWAP_REMOTE = 1;

const STARGATE_POOL_ID_USDC = 1;
const STARGATE_POOL_ID_ETH = 13;

const STARGATE_UNKNOWN_POOL_ID = 99;
const STARGATE_UNKNOWN_CHAIN_ID = 99;

const PARTNER_ID = STARGATE_PARTNER_ID;

function stargateFormat(num) {
  return num.toString().padEnd(66, '0'); // include 0x for a 32 bit data
}

contract('Stargate', function ([_, user, user2]) {
  before(async function () {
    wrappedNativeTokenProviderAddress = await getTokenProvider(
      WRAPPED_NATIVE_TOKEN
    );

    this.feeRuleRegistry = await FeeRuleRegistry.new('0', _);
    this.registry = await Registry.new();
    this.proxy = await Proxy.new(
      this.registry.address,
      this.feeRuleRegistry.address
    );

    this.hStargate = await HStargate.new(
      STARGATE_ROUTER,
      STARGATE_ROUTER_ETH,
      STG_TOKEN,
      STARGATE_FACTORY,
      STARGATE_WIDGET_SWAP,
      PARTNER_ID
    );

    await this.registry.register(
      this.hStargate.address,
      utils.asciiToHex('Stargate')
    );

    this.wrappedNativeToken = await IToken.at(WRAPPED_NATIVE_TOKEN);
    this.stargateRouter = await IStartgateRouter.at(STARGATE_ROUTER);
    this.stargateFactory = await IStargateFactory.at(STARGATE_FACTORY);
    this.stargateWidget = await IStargateWidget.at(STARGATE_WIDGET_SWAP);
  });

  beforeEach(async function () {
    id = await evmSnapshot();
    balanceUser = await tracker(user);
    balanceProxy = await tracker(this.proxy.address);
  });

  afterEach(async function () {
    await evmRevert(id);
  });

  describe('Swap', function () {
    const dstChainId = STARGATE_DESTINATION_CHAIN_ID;
    const amountOutMin = 0;
    const receiver = user;

    const funcType = TYPE_SWAP_REMOTE;
    const payload = '0x';

    describe('Native', function () {
      if (chainId == 137 || chainId == 43114) {
        // Stargate does not support MATIC / AVAX for now
        return;
      }

      beforeEach(async function () {
        balanceVaultETH = await tracker(STARGATE_VAULT_ETH);
      });

      const amountIn = ether('10');

      // to the same address and amountOutMin = 0
      it('normal', async function () {
        // Prep
        const refundAddress = this.proxy.address;
        const to = this.hStargate.address;
        const fees = await this.stargateRouter.quoteLayerZeroFee(
          dstChainId,
          funcType,
          receiver,
          payload,
          { dstGasForCall: 0, dstNativeAmount: 0, dstNativeAddr: '0x' } // lzTxObj
        );
        const fee = fees[0];
        const value = amountIn.add(fee);
        const data = abi.simpleEncode(
          'swapETH(uint256,uint16,address,uint256,uint256,address)',
          value,
          dstChainId,
          refundAddress,
          fee,
          amountOutMin,
          receiver
        );

        // Execute
        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: value,
        });

        // Verify
        expect(await balanceProxy.get()).to.be.bignumber.zero;
        expect(await balanceUser.delta()).to.be.bignumber.eq(
          ether('0').sub(value)
        );
        expect(await balanceVaultETH.delta()).to.be.bignumber.eq(amountIn);

        await expectEvent.inTransaction(
          receipt.tx,
          this.stargateWidget,
          'PartnerSwap',
          { partnerId: stargateFormat(PARTNER_ID) }
        );
        profileGas(receipt);
      });

      it('max amount', async function () {
        // Prep
        const refundAddress = this.proxy.address;
        const to = this.hStargate.address;
        const fees = await this.stargateRouter.quoteLayerZeroFee(
          dstChainId,
          funcType,
          receiver,
          payload,
          { dstGasForCall: 0, dstNativeAmount: 0, dstNativeAddr: '0x' } // lzTxObj
        );
        const fee = fees[0];
        const value = amountIn.add(fee);
        const data = abi.simpleEncode(
          'swapETH(uint256,uint16,address,uint256,uint256,address)',
          MAX_UINT256,
          dstChainId,
          refundAddress,
          fee,
          amountOutMin,
          receiver
        );

        // Execute
        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: value,
        });

        // Verify
        expect(await balanceProxy.get()).to.be.bignumber.zero;
        expect(await balanceUser.delta()).to.be.bignumber.eq(
          ether('0').sub(value)
        );
        expect(await balanceVaultETH.delta()).to.be.bignumber.eq(amountIn);

        await expectEvent.inTransaction(
          receipt.tx,
          this.stargateWidget,
          'PartnerSwap',
          { partnerId: stargateFormat(PARTNER_ID) }
        );
        profileGas(receipt);
      });

      it('to a different address', async function () {
        // Prep
        const receiver = user2;
        const refundAddress = this.proxy.address;
        const to = this.hStargate.address;
        const fees = await this.stargateRouter.quoteLayerZeroFee(
          dstChainId,
          funcType,
          receiver,
          payload,
          { dstGasForCall: 0, dstNativeAmount: 0, dstNativeAddr: '0x' } // lzTxObj
        );
        const fee = fees[0];
        const value = amountIn.add(fee);
        const data = abi.simpleEncode(
          'swapETH(uint256,uint16,address,uint256,uint256,address)',
          value,
          dstChainId,
          refundAddress,
          fee,
          amountOutMin,
          receiver
        );

        // Execute
        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: value,
        });

        // Verify
        expect(await balanceProxy.get()).to.be.bignumber.zero;
        expect(await balanceUser.delta()).to.be.bignumber.eq(
          ether('0').sub(value)
        );
        expect(await balanceVaultETH.delta()).to.be.bignumber.eq(amountIn);

        await expectEvent.inTransaction(
          receipt.tx,
          this.stargateWidget,
          'PartnerSwap',
          { partnerId: stargateFormat(PARTNER_ID) }
        );
        profileGas(receipt);
      });

      it('refund extra fee', async function () {
        // Prep
        const refundAddress = this.proxy.address;
        const to = this.hStargate.address;
        const fees = await this.stargateRouter.quoteLayerZeroFee(
          dstChainId,
          funcType,
          receiver,
          payload,
          { dstGasForCall: 0, dstNativeAmount: 0, dstNativeAddr: '0x' } // lzTxObj
        );
        const fee = fees[0];
        const extraFee = fee.mul(new BN('2'));
        const totalFee = fee.add(extraFee);
        const value = amountIn.add(totalFee);
        const data = abi.simpleEncode(
          'swapETH(uint256,uint16,address,uint256,uint256,address)',
          value,
          dstChainId,
          refundAddress,
          totalFee,
          amountOutMin,
          receiver
        );

        // Execute
        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: value,
        });

        // Verify
        expect(await balanceProxy.get()).to.be.bignumber.zero;
        expect(await balanceUser.delta()).to.be.bignumber.eq(
          ether('0').sub(value).add(extraFee)
        );
        expect(await balanceVaultETH.delta()).to.be.bignumber.eq(amountIn);

        await expectEvent.inTransaction(
          receipt.tx,
          this.stargateWidget,
          'PartnerSwap',
          { partnerId: stargateFormat(PARTNER_ID) }
        );
        profileGas(receipt);
      });

      // chain
      it('should revert: to unsupported chain', async function () {
        // Prep
        const dstChainId = STARGATE_UNSUPPORT_ETH_DEST_CHAIN_ID;
        const refundAddress = this.proxy.address;
        const to = this.hStargate.address;
        const fees = await this.stargateRouter.quoteLayerZeroFee(
          dstChainId,
          funcType,
          receiver,
          payload,
          { dstGasForCall: 0, dstNativeAmount: 0, dstNativeAddr: '0x' } // lzTxObj
        );
        const fee = fees[0];
        const value = amountIn.add(fee);
        const data = abi.simpleEncode(
          'swapETH(uint256,uint16,address,uint256,uint256,address)',
          value,
          dstChainId,
          refundAddress,
          fee,
          amountOutMin,
          receiver
        );

        // Execute
        await expectRevert(
          this.proxy.execMock(to, data, {
            from: user,
            value: value,
          }),
          '0_HStargate_swapETH: Stargate: local chainPath does not exist'
        );
      });

      it('should revert: to unknown chain', async function () {
        // Prep
        const dstChainId = STARGATE_UNKNOWN_CHAIN_ID;
        const refundAddress = this.proxy.address;
        const to = this.hStargate.address;
        const fee = ether('1'); // Use fixed fee because of unknown chain id
        const value = amountIn.add(fee);
        const data = abi.simpleEncode(
          'swapETH(uint256,uint16,address,uint256,uint256,address)',
          value,
          dstChainId,
          refundAddress,
          fee,
          amountOutMin,
          receiver
        );

        // Execute
        await expectRevert(
          this.proxy.execMock(to, data, {
            from: user,
            value: value,
          }),
          '0_HStargate_swapETH: Stargate: local chainPath does not exist'
        );
      });

      it('should revert: to stable token', async function () {
        // Prep
        const srcPoolId = STARGATE_POOL_ID_ETH;
        const dstPoolId = STARGATE_POOL_ID_USDC;
        const amountIn = mwei('10');
        const refundAddress = this.proxy.address;
        const to = this.hStargate.address;
        const fee = ether('1'); // Use fixed fee because of unsupported path
        const data = abi.simpleEncode(
          'swap(uint16,uint256,uint256,address,uint256,uint256,uint256,address)',
          dstChainId,
          srcPoolId,
          dstPoolId,
          refundAddress,
          amountIn,
          fee,
          amountOutMin,
          receiver
        );

        // Execute
        const value = fee;
        await expectRevert(
          this.proxy.execMock(to, data, {
            from: user,
            value: value,
          }),
          '0_HStargate_swap: Stargate: local chainPath does not exist'
        );
      });

      // fee
      it('should revert: without fee', async function () {
        // Prep
        const refundAddress = this.proxy.address;
        const to = this.hStargate.address;
        const fee = ether('0');
        const value = amountIn.add(fee);
        const data = abi.simpleEncode(
          'swapETH(uint256,uint16,address,uint256,uint256,address)',
          value,
          dstChainId,
          refundAddress,
          fee,
          amountOutMin,
          receiver
        );

        // Execute
        await expectRevert(
          this.proxy.execMock(to, data, {
            from: user,
            value: value,
          }),
          '0_HStargate_swapETH: Stargate: msg.value must be > _amountLD'
        );
      });

      it('should revert: insufficient fee', async function () {
        // Prep
        const refundAddress = this.proxy.address;
        const to = this.hStargate.address;
        const fees = await this.stargateRouter.quoteLayerZeroFee(
          dstChainId,
          funcType,
          receiver,
          payload,
          { dstGasForCall: 0, dstNativeAmount: 0, dstNativeAddr: '0x' } // lzTxObj
        );
        const fee = fees[0].div(new BN('2'));
        const value = amountIn.add(fee);
        const data = abi.simpleEncode(
          'swapETH(uint256,uint16,address,uint256,uint256,address)',
          value,
          dstChainId,
          refundAddress,
          fee,
          amountOutMin,
          receiver
        );

        // Execute
        await expectRevert(
          this.proxy.execMock(to, data, {
            from: user,
            value: value,
          }),
          '0_HStargate_swapETH: LayerZero: not enough native for fees'
        );
      });

      // amount
      it('should revert: amountIn = 0', async function () {
        // Prep
        const amountIn = ether('0');
        const refundAddress = this.proxy.address;
        const to = this.hStargate.address;
        const fees = await this.stargateRouter.quoteLayerZeroFee(
          dstChainId,
          funcType,
          receiver,
          payload,
          { dstGasForCall: 0, dstNativeAmount: 0, dstNativeAddr: '0x' } // lzTxObj
        );
        const fee = fees[0];
        const value = amountIn.add(fee);
        const data = abi.simpleEncode(
          'swapETH(uint256,uint16,address,uint256,uint256,address)',
          value,
          dstChainId,
          refundAddress,
          fee,
          amountOutMin,
          receiver
        );

        // Execute
        await expectRevert(
          this.proxy.execMock(to, data, {
            from: user,
            value: value,
          }),
          '0_HStargate_swapETH: Stargate: cannot swap 0'
        );
      });

      it('should revert: amountOutMin = amountIn', async function () {
        // Prep
        const amountOutMin = amountIn;
        const refundAddress = this.proxy.address;
        const to = this.hStargate.address;
        const fees = await this.stargateRouter.quoteLayerZeroFee(
          dstChainId,
          funcType,
          receiver,
          payload,
          { dstGasForCall: 0, dstNativeAmount: 0, dstNativeAddr: '0x' } // lzTxObj
        );
        const fee = fees[0];
        const value = amountIn.add(fee);
        const data = abi.simpleEncode(
          'swapETH(uint256,uint16,address,uint256,uint256,address)',
          value,
          dstChainId,
          refundAddress,
          fee,
          amountOutMin,
          receiver
        );

        // Execute
        await expectRevert(
          this.proxy.execMock(to, data, {
            from: user,
            value: value,
          }),
          '0_HStargate_swapETH: Stargate: slippage too high'
        );
      });

      it('should revert: amountIn = pool total balance', async function () {
        // Prep
        const amountIn = await balanceVaultETH.get();
        await network.provider.send('hardhat_setBalance', [
          user,
          '0x' + amountIn,
        ]);
        const refundAddress = this.proxy.address;
        const to = this.hStargate.address;
        const fees = await this.stargateRouter.quoteLayerZeroFee(
          dstChainId,
          funcType,
          receiver,
          payload,
          { dstGasForCall: 0, dstNativeAmount: 0, dstNativeAddr: '0x' } // lzTxObj
        );
        const fee = fees[0];
        const value = amountIn.add(fee);
        const data = abi.simpleEncode(
          'swapETH(uint256,uint16,address,uint256,uint256,address)',
          value,
          dstChainId,
          refundAddress,
          fee,
          amountOutMin,
          receiver
        );

        // Execute
        await expectRevert(
          this.proxy.execMock(to, data, {
            from: user,
            value: value,
          }),
          '0_HStargate_swapETH: FeeLibrary: not enough balance'
        );
      });

      // address
      it('should revert: refund zero address', async function () {
        // Prep
        const refundAddress = constants.ZERO_ADDRESS;
        const to = this.hStargate.address;
        const fees = await this.stargateRouter.quoteLayerZeroFee(
          dstChainId,
          funcType,
          receiver,
          payload,
          { dstGasForCall: 0, dstNativeAmount: 0, dstNativeAddr: '0x' } // lzTxObj
        );
        const fee = fees[0];
        const value = amountIn.add(fee);
        const data = abi.simpleEncode(
          'swapETH(uint256,uint16,address,uint256,uint256,address)',
          value,
          dstChainId,
          refundAddress,
          fee,
          amountOutMin,
          receiver
        );

        // Execute
        await expectRevert(
          this.proxy.execMock(to, data, {
            from: user,
            value: value,
          }),
          '0_HStargate_swapETH: Stargate: _refundAddress cannot be 0x0'
        );
      });

      it('should revert: to zero address', async function () {
        // Prep
        const receiver = constants.ZERO_ADDRESS;
        const refundAddress = this.proxy.address;
        const to = this.hStargate.address;
        const fees = await this.stargateRouter.quoteLayerZeroFee(
          dstChainId,
          funcType,
          receiver,
          payload,
          { dstGasForCall: 0, dstNativeAmount: 0, dstNativeAddr: '0x' } // lzTxObj
        );
        const fee = fees[0];
        const value = amountIn.add(fee);
        const data = abi.simpleEncode(
          'swapETH(uint256,uint16,address,uint256,uint256,address)',
          value,
          dstChainId,
          refundAddress,
          fee,
          amountOutMin,
          receiver
        );

        // Execute
        await expectRevert(
          this.proxy.execMock(to, data, {
            from: user,
            value: value,
          }),
          '0_HStargate_swapETH: to zero address'
        );
      });
    });

    describe('Stable', function () {
      const inputTokenAddr = USDC_TOKEN;
      const INPUT_TOKEN_BALANCE_SLOT_NUM = 9;

      const srcPoolId = STARGATE_POOL_ID_USDC;
      const dstPoolId = STARGATE_POOL_ID_USDC;
      const amountIn = mwei('10');

      let inputTokenPoolBefore;

      before(async function () {
        inputTokenProvider = await getTokenProvider(inputTokenAddr);
        this.inputToken = await IToken.at(inputTokenAddr);
      });

      this.beforeEach(async function () {
        await this.inputToken.transfer(this.proxy.address, amountIn, {
          from: inputTokenProvider,
        });
        await this.proxy.updateTokenMock(this.inputToken.address);

        inputTokenPoolBefore = await this.inputToken.balanceOf(
          STARGATE_POOL_USDC
        );
      });

      // to the same address and amountOutMin = 0
      it('normal', async function () {
        // Prep
        const refundAddress = this.proxy.address;
        const to = this.hStargate.address;
        const fees = await this.stargateRouter.quoteLayerZeroFee(
          dstChainId,
          funcType,
          receiver,
          payload,
          { dstGasForCall: 0, dstNativeAmount: 0, dstNativeAddr: '0x' } // lzTxObj
        );
        const fee = fees[0];
        const data = abi.simpleEncode(
          'swap(uint16,uint256,uint256,address,uint256,uint256,uint256,address)',
          dstChainId,
          srcPoolId,
          dstPoolId,
          refundAddress,
          amountIn,
          fee,
          amountOutMin,
          receiver
        );

        // Execute
        const value = fee;
        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: value,
        });

        // Verify
        expect(await balanceProxy.get()).to.be.bignumber.zero;
        expect(
          await this.inputToken.balanceOf(this.proxy.address)
        ).to.be.bignumber.zero;
        expect(await balanceUser.delta()).to.be.bignumber.eq(
          ether('0').sub(fee)
        );
        expect(
          await this.inputToken.balanceOf(STARGATE_POOL_USDC)
        ).to.be.bignumber.eq(inputTokenPoolBefore.add(amountIn));

        await expectEvent.inTransaction(
          receipt.tx,
          this.stargateWidget,
          'PartnerSwap',
          { partnerId: stargateFormat(PARTNER_ID) }
        );
        profileGas(receipt);
      });

      it('max amount', async function () {
        // Prep
        const refundAddress = this.proxy.address;
        const to = this.hStargate.address;
        const fees = await this.stargateRouter.quoteLayerZeroFee(
          dstChainId,
          funcType,
          receiver,
          payload,
          { dstGasForCall: 0, dstNativeAmount: 0, dstNativeAddr: '0x' } // lzTxObj
        );
        const fee = fees[0];
        const data = abi.simpleEncode(
          'swap(uint16,uint256,uint256,address,uint256,uint256,uint256,address)',
          dstChainId,
          srcPoolId,
          dstPoolId,
          refundAddress,
          MAX_UINT256,
          fee,
          amountOutMin,
          receiver
        );

        // Execute
        const value = fee;
        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: value,
        });

        // Verify
        expect(await balanceProxy.get()).to.be.bignumber.zero;
        expect(
          await this.inputToken.balanceOf(this.proxy.address)
        ).to.be.bignumber.zero;
        expect(await balanceUser.delta()).to.be.bignumber.eq(
          ether('0').sub(fee)
        );
        expect(
          await this.inputToken.balanceOf(STARGATE_POOL_USDC)
        ).to.be.bignumber.eq(inputTokenPoolBefore.add(amountIn));

        await expectEvent.inTransaction(
          receipt.tx,
          this.stargateWidget,
          'PartnerSwap',
          { partnerId: stargateFormat(PARTNER_ID) }
        );
        profileGas(receipt);
      });

      it('to a different address', async function () {
        // Prep
        const receiver = user2;
        const refundAddress = this.proxy.address;
        const to = this.hStargate.address;
        const fees = await this.stargateRouter.quoteLayerZeroFee(
          dstChainId,
          funcType,
          receiver,
          payload,
          { dstGasForCall: 0, dstNativeAmount: 0, dstNativeAddr: '0x' } // lzTxObj
        );
        const fee = fees[0];
        const data = abi.simpleEncode(
          'swap(uint16,uint256,uint256,address,uint256,uint256,uint256,address)',
          dstChainId,
          srcPoolId,
          dstPoolId,
          refundAddress,
          amountIn,
          fee,
          amountOutMin,
          receiver
        );

        // Execute
        const value = fee;
        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: value,
        });

        // Verify
        expect(await balanceProxy.get()).to.be.bignumber.zero;
        expect(
          await this.inputToken.balanceOf(this.proxy.address)
        ).to.be.bignumber.zero;
        expect(await balanceUser.delta()).to.be.bignumber.eq(
          ether('0').sub(fee)
        );
        expect(
          await this.inputToken.balanceOf(STARGATE_POOL_USDC)
        ).to.be.bignumber.eq(inputTokenPoolBefore.add(amountIn));

        await expectEvent.inTransaction(
          receipt.tx,
          this.stargateWidget,
          'PartnerSwap',
          { partnerId: stargateFormat(PARTNER_ID) }
        );
        profileGas(receipt);
      });

      it('refund extra fee', async function () {
        // Prep
        const refundAddress = this.proxy.address;
        const to = this.hStargate.address;
        const fees = await this.stargateRouter.quoteLayerZeroFee(
          dstChainId,
          funcType,
          receiver,
          payload,
          { dstGasForCall: 0, dstNativeAmount: 0, dstNativeAddr: '0x' } // lzTxObj
        );
        const fee = fees[0];
        const extraFee = fee.mul(new BN('2'));
        const totalFee = fee.add(extraFee);
        const data = abi.simpleEncode(
          'swap(uint16,uint256,uint256,address,uint256,uint256,uint256,address)',
          dstChainId,
          srcPoolId,
          dstPoolId,
          refundAddress,
          amountIn,
          totalFee,
          amountOutMin,
          receiver
        );

        // Execute
        const value = totalFee;
        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: value,
        });

        // Verify
        expect(await balanceProxy.get()).to.be.bignumber.zero;
        expect(
          await this.inputToken.balanceOf(this.proxy.address)
        ).to.be.bignumber.zero;
        expect(await balanceUser.delta()).to.be.bignumber.eq(
          ether('0').sub(totalFee).add(extraFee)
        );
        expect(
          await this.inputToken.balanceOf(STARGATE_POOL_USDC)
        ).to.be.bignumber.eq(inputTokenPoolBefore.add(amountIn));

        await expectEvent.inTransaction(
          receipt.tx,
          this.stargateWidget,
          'PartnerSwap',
          { partnerId: stargateFormat(PARTNER_ID) }
        );
        profileGas(receipt);
      });

      // chain
      it('should revert: to unknown chain', async function () {
        // Prep
        const dstChainId = STARGATE_UNKNOWN_CHAIN_ID;
        const refundAddress = this.proxy.address;
        const to = this.hStargate.address;
        const fee = ether('1'); // Use fixed fee because of unknown chain id
        const data = abi.simpleEncode(
          'swap(uint16,uint256,uint256,address,uint256,uint256,uint256,address)',
          dstChainId,
          srcPoolId,
          dstPoolId,
          refundAddress,
          amountIn,
          fee,
          amountOutMin,
          receiver
        );

        // Execute
        const value = fee;
        await expectRevert(
          this.proxy.execMock(to, data, {
            from: user,
            value: value,
          }),
          '0_HStargate_swap: Stargate: local chainPath does not exist'
        );
      });

      // token
      it('should revert: from unknown src token', async function () {
        // Prep
        const srcPoolId = STARGATE_UNKNOWN_POOL_ID;
        const refundAddress = this.proxy.address;
        const to = this.hStargate.address;
        const fee = ether('1'); // Use fixed fee because of unknown pool id
        const data = abi.simpleEncode(
          'swap(uint16,uint256,uint256,address,uint256,uint256,uint256,address)',
          dstChainId,
          srcPoolId,
          dstPoolId,
          refundAddress,
          amountIn,
          fee,
          amountOutMin,
          receiver
        );

        // Execute
        const value = fee;
        await expectRevert(
          this.proxy.execMock(to, data, {
            from: user,
            value: value,
          }),
          '0_HStargate_swap: pool not found'
        );
      });

      it('should revert: to unknown token', async function () {
        // Prep
        const dstPoolId = STARGATE_UNKNOWN_POOL_ID;
        const refundAddress = this.proxy.address;
        const to = this.hStargate.address;
        const fee = ether('1'); // Use fixed fee because of unknown pool id
        const data = abi.simpleEncode(
          'swap(uint16,uint256,uint256,address,uint256,uint256,uint256,address)',
          dstChainId,
          srcPoolId,
          dstPoolId,
          refundAddress,
          amountIn,
          fee,
          amountOutMin,
          receiver
        );

        // Execute
        const value = fee;
        await expectRevert(
          this.proxy.execMock(to, data, {
            from: user,
            value: value,
          }),
          '0_HStargate_swap: Stargate: local chainPath does not exist'
        );
      });

      it('should revert: to disallowed stable token', async function () {
        // Prep
        const dstPoolId = STARGATE_USDC_TO_DISALLOW_TOKEN_ID;
        const refundAddress = this.proxy.address;
        const to = this.hStargate.address;
        const fee = ether('1'); // Use fixed fee because of unsupported path
        const data = abi.simpleEncode(
          'swap(uint16,uint256,uint256,address,uint256,uint256,uint256,address)',
          dstChainId,
          srcPoolId,
          dstPoolId,
          refundAddress,
          amountIn,
          fee,
          amountOutMin,
          receiver
        );

        // Execute
        const value = fee;
        await expectRevert(
          this.proxy.execMock(to, data, {
            from: user,
            value: value,
          }),
          '0_HStargate_swap: Stargate: local chainPath does not exist'
        );
      });

      it('should revert: to native token', async function () {
        // Prep
        const dstPoolId = STARGATE_POOL_ID_ETH;
        const refundAddress = this.proxy.address;
        const to = this.hStargate.address;
        const fee = ether('1'); // Use fixed fee because of unsupported path
        const data = abi.simpleEncode(
          'swap(uint16,uint256,uint256,address,uint256,uint256,uint256,address)',
          dstChainId,
          srcPoolId,
          dstPoolId,
          refundAddress,
          amountIn,
          fee,
          amountOutMin,
          receiver
        );

        // Execute
        const value = fee;
        await expectRevert(
          this.proxy.execMock(to, data, {
            from: user,
            value: value,
          }),
          '0_HStargate_swap: Stargate: local chainPath does not exist'
        );
      });

      // fee
      it('should revert: insufficient fee', async function () {
        // Prep
        const refundAddress = this.proxy.address;
        const to = this.hStargate.address;
        const fee = ether('0'); // Send zero fee
        const data = abi.simpleEncode(
          'swap(uint16,uint256,uint256,address,uint256,uint256,uint256,address)',
          dstChainId,
          srcPoolId,
          dstPoolId,
          refundAddress,
          amountIn,
          fee,
          amountOutMin,
          receiver
        );

        // Execute
        const value = fee;
        await expectRevert(
          this.proxy.execMock(to, data, {
            from: user,
            value: value,
          }),
          '0_HStargate_swap: LayerZero: not enough native for fees'
        );
      });

      // amount
      it('should revert: amountIn = 0', async function () {
        // Prep
        const amountIn = ether('0');
        const refundAddress = this.proxy.address;
        const to = this.hStargate.address;
        const fees = await this.stargateRouter.quoteLayerZeroFee(
          dstChainId,
          funcType,
          receiver,
          payload,
          { dstGasForCall: 0, dstNativeAmount: 0, dstNativeAddr: '0x' } // lzTxObj
        );
        const fee = fees[0];
        const data = abi.simpleEncode(
          'swap(uint16,uint256,uint256,address,uint256,uint256,uint256,address)',
          dstChainId,
          srcPoolId,
          dstPoolId,
          refundAddress,
          amountIn,
          fee,
          amountOutMin,
          receiver
        );

        // Execute
        const value = fee;
        await expectRevert(
          this.proxy.execMock(to, data, {
            from: user,
            value: value,
          }),
          '0_HStargate_swap: Stargate: cannot swap 0'
        );
      });

      it('should revert: amountOutMin = amountIn', async function () {
        // Prep
        const amountOutMin = amountIn;
        const refundAddress = this.proxy.address;
        const to = this.hStargate.address;
        const fees = await this.stargateRouter.quoteLayerZeroFee(
          dstChainId,
          funcType,
          receiver,
          payload,
          { dstGasForCall: 0, dstNativeAmount: 0, dstNativeAddr: '0x' } // lzTxObj
        );
        const fee = fees[0];
        const data = abi.simpleEncode(
          'swap(uint16,uint256,uint256,address,uint256,uint256,uint256,address)',
          dstChainId,
          srcPoolId,
          dstPoolId,
          refundAddress,
          amountIn,
          fee,
          amountOutMin,
          receiver
        );

        // Execute
        const value = fee;
        await expectRevert(
          this.proxy.execMock(to, data, {
            from: user,
            value: value,
          }),
          '0_HStargate_swap: Stargate: slippage too high'
        );
      });

      it('should revert: amountIn = pool total balance', async function () {
        // Prep
        const amountIn = inputTokenPoolBefore;
        const refundAddress = this.proxy.address;
        const to = this.hStargate.address;

        await setTokenBalance(
          this.inputToken.address,
          this.proxy.address,
          amountIn,
          INPUT_TOKEN_BALANCE_SLOT_NUM
        );

        const fees = await this.stargateRouter.quoteLayerZeroFee(
          dstChainId,
          funcType,
          receiver,
          payload,
          { dstGasForCall: 0, dstNativeAmount: 0, dstNativeAddr: '0x' } // lzTxObj
        );
        const fee = fees[0];
        const data = abi.simpleEncode(
          'swap(uint16,uint256,uint256,address,uint256,uint256,uint256,address)',
          dstChainId,
          srcPoolId,
          dstPoolId,
          refundAddress,
          amountIn,
          fee,
          amountOutMin,
          receiver
        );

        // Execute
        const value = fee;
        await expectRevert(
          this.proxy.execMock(to, data, {
            from: user,
            value: value,
          }),
          '0_HStargate_swap: FeeLibrary: not enough balance'
        );
      });

      // address
      it('should revert: refund zero address', async function () {
        // Prep
        const refundAddress = constants.ZERO_ADDRESS;
        const to = this.hStargate.address;
        const fees = await this.stargateRouter.quoteLayerZeroFee(
          dstChainId,
          funcType,
          receiver,
          payload,
          { dstGasForCall: 0, dstNativeAmount: 0, dstNativeAddr: '0x' } // lzTxObj
        );
        const fee = fees[0];
        const data = abi.simpleEncode(
          'swap(uint16,uint256,uint256,address,uint256,uint256,uint256,address)',
          dstChainId,
          srcPoolId,
          dstPoolId,
          refundAddress,
          amountIn,
          fee,
          amountOutMin,
          receiver
        );

        // Execute
        const value = fee;
        await expectRevert(
          this.proxy.execMock(to, data, {
            from: user,
            value: value,
          }),
          '0_HStargate_swap: Stargate: _refundAddress cannot be 0x0'
        );
      });

      it('should revert: to zero address', async function () {
        // Prep
        const refundAddress = this.proxy.address;
        const receiver = constants.ZERO_ADDRESS;
        const to = this.hStargate.address;
        const fees = await this.stargateRouter.quoteLayerZeroFee(
          dstChainId,
          funcType,
          receiver,
          payload,
          { dstGasForCall: 0, dstNativeAmount: 0, dstNativeAddr: '0x' } // lzTxObj
        );
        const fee = fees[0];
        const data = abi.simpleEncode(
          'swap(uint16,uint256,uint256,address,uint256,uint256,uint256,address)',
          dstChainId,
          srcPoolId,
          dstPoolId,
          refundAddress,
          amountIn,
          fee,
          amountOutMin,
          receiver
        );

        // Execute
        const value = fee;
        await expectRevert(
          this.proxy.execMock(to, data, {
            from: user,
            value: value,
          }),
          '0_HStargate_swap: to zero address'
        );
      });
    });

    describe('STG Token', function () {
      const version = new BN('1');
      const inputTokenAddr = STG_TOKEN;
      const amountIn = ether('1');
      const dstGas = new BN('85000'); // stg gas value from a real tx
      const receiverBytes = abi.solidityPack(['address'], [receiver]);
      const payload = abi.rawEncode(
        ['bytes', 'uint256'],
        [receiverBytes, amountIn]
      );
      const adapterParam = abi.solidityPack(
        ['uint16', 'uint256'],
        [version, dstGas]
      );

      let inputTokenPoolBefore;
      let isMain;

      before(async function () {
        inputTokenProvider = STARGATE_MULTISIG;
        await impersonateAndInjectEther(inputTokenProvider);
        this.inputToken = await IToken.at(inputTokenAddr);
        this.inputStgToken = await IStargateToken.at(inputTokenAddr);
        this.layerZeroEndpoint = await ILayerZeroEndpoint.at(
          LAYERZERO_ENDPOINT
        );
      });

      this.beforeEach(async function () {
        await this.inputToken.transfer(this.proxy.address, amountIn, {
          from: inputTokenProvider,
        });
        await this.proxy.updateTokenMock(this.inputToken.address);

        inputTokenPoolBefore = await this.inputToken.balanceOf(inputTokenAddr);
        isMain = await this.inputStgToken.isMain.call();
      });

      it('normal', async function () {
        // Prep
        const to = this.hStargate.address;
        const fees = await this.layerZeroEndpoint.estimateFees(
          dstChainId,
          this.inputToken.address,
          payload,
          false, // pay in zero
          adapterParam
        );
        const fee = fees[0];
        const data = abi.simpleEncode(
          'sendTokens(uint16,address,uint256,uint256,uint256)',
          dstChainId,
          receiver,
          amountIn,
          fee,
          dstGas
        );

        // Execute
        const value = fee;
        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: value,
        });

        // Verify
        expect(await balanceProxy.get()).to.be.bignumber.zero;
        expect(
          await this.inputToken.balanceOf(this.proxy.address)
        ).to.be.bignumber.zero;
        expect(await balanceUser.delta()).to.be.bignumber.eq(
          ether('0').sub(fee)
        );

        isMain
          ? expect(
              await this.inputToken.balanceOf(inputTokenAddr)
            ).to.be.bignumber.eq(inputTokenPoolBefore.add(amountIn)) // lock token
          : expect(
              await this.inputToken.balanceOf(inputTokenAddr)
            ).to.be.bignumber.eq(inputTokenPoolBefore); // burn token

        await expectEvent.inTransaction(
          receipt.tx,
          this.inputStgToken,
          'SendToChain',
          {
            dstChainId: dstChainId.toString(),
            to: receiver.toString().toLowerCase(),
            qty: amountIn.toString(),
          }
        );

        await expectEvent.inTransaction(
          receipt.tx,
          this.stargateWidget,
          'PartnerSwap',
          { partnerId: stargateFormat(PARTNER_ID) }
        );
        profileGas(receipt);
      });

      it('max amount', async function () {
        // Prep
        const to = this.hStargate.address;
        const fees = await this.layerZeroEndpoint.estimateFees(
          dstChainId,
          this.inputToken.address,
          payload,
          false, // pay in zero
          adapterParam
        );
        const fee = fees[0];
        const data = abi.simpleEncode(
          'sendTokens(uint16,address,uint256,uint256,uint256)',
          dstChainId,
          receiver,
          MAX_UINT256,
          fee,
          dstGas
        );

        // Execute
        const value = fee;
        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: value,
        });

        // Verify
        expect(await balanceProxy.get()).to.be.bignumber.zero;
        expect(
          await this.inputToken.balanceOf(this.proxy.address)
        ).to.be.bignumber.zero;
        expect(await balanceUser.delta()).to.be.bignumber.eq(
          ether('0').sub(fee)
        );

        isMain
          ? expect(
              await this.inputToken.balanceOf(inputTokenAddr)
            ).to.be.bignumber.eq(inputTokenPoolBefore.add(amountIn)) // lock token
          : expect(
              await this.inputToken.balanceOf(inputTokenAddr)
            ).to.be.bignumber.eq(inputTokenPoolBefore); // burn token

        await expectEvent.inTransaction(
          receipt.tx,
          this.inputStgToken,
          'SendToChain',
          {
            dstChainId: dstChainId.toString(),
            to: receiver.toString().toLowerCase(),
            qty: amountIn.toString(),
          }
        );

        await expectEvent.inTransaction(
          receipt.tx,
          this.stargateWidget,
          'PartnerSwap',
          { partnerId: stargateFormat(PARTNER_ID) }
        );
        profileGas(receipt);
      });

      it('to a different address', async function () {
        // Prep
        const receiver = user2;
        const receiverBytes = abi.solidityPack(['address'], [receiver]);
        const payload = abi.rawEncode(
          ['bytes', 'uint256'],
          [receiverBytes, amountIn]
        );
        const to = this.hStargate.address;
        const fees = await this.layerZeroEndpoint.estimateFees(
          dstChainId,
          this.inputToken.address,
          payload,
          false, // pay in zero
          adapterParam
        );
        const fee = fees[0];
        const data = abi.simpleEncode(
          'sendTokens(uint16,address,uint256,uint256,uint256)',
          dstChainId,
          receiver,
          amountIn,
          fee,
          dstGas
        );

        // Execute
        const value = fee;
        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: value,
        });

        // Verify
        expect(await balanceProxy.get()).to.be.bignumber.zero;
        expect(
          await this.inputToken.balanceOf(this.proxy.address)
        ).to.be.bignumber.zero;
        expect(await balanceUser.delta()).to.be.bignumber.eq(
          ether('0').sub(fee)
        );

        isMain
          ? expect(
              await this.inputToken.balanceOf(inputTokenAddr)
            ).to.be.bignumber.eq(inputTokenPoolBefore.add(amountIn)) // lock token
          : expect(
              await this.inputToken.balanceOf(inputTokenAddr)
            ).to.be.bignumber.eq(inputTokenPoolBefore); // burn token

        await expectEvent.inTransaction(
          receipt.tx,
          this.inputStgToken,
          'SendToChain',
          {
            dstChainId: dstChainId.toString(),
            to: receiver.toString().toLowerCase(),
            qty: amountIn.toString(),
          }
        );

        await expectEvent.inTransaction(
          receipt.tx,
          this.stargateWidget,
          'PartnerSwap',
          { partnerId: stargateFormat(PARTNER_ID) }
        );
        profileGas(receipt);
      });

      it('refund extra fee', async function () {
        // Prep
        const to = this.hStargate.address;
        const fees = await this.layerZeroEndpoint.estimateFees(
          dstChainId,
          this.inputToken.address,
          payload,
          false, // pay in zero
          adapterParam
        );
        const fee = fees[0];
        const extraFee = fee.mul(new BN('2'));
        const totalFee = fee.add(extraFee);
        const data = abi.simpleEncode(
          'sendTokens(uint16,address,uint256,uint256,uint256)',
          dstChainId,
          receiver,
          amountIn,
          totalFee,
          dstGas
        );

        // Execute
        const value = totalFee;
        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: value,
        });

        // Verify
        expect(await balanceProxy.get()).to.be.bignumber.zero;
        expect(
          await this.inputToken.balanceOf(this.proxy.address)
        ).to.be.bignumber.zero;
        expect(await balanceUser.delta()).to.be.bignumber.eq(
          ether('0').sub(totalFee).add(extraFee)
        );

        isMain
          ? expect(
              await this.inputToken.balanceOf(inputTokenAddr)
            ).to.be.bignumber.eq(inputTokenPoolBefore.add(amountIn)) // lock token
          : expect(
              await this.inputToken.balanceOf(inputTokenAddr)
            ).to.be.bignumber.eq(inputTokenPoolBefore); // burn token

        await expectEvent.inTransaction(
          receipt.tx,
          this.inputStgToken,
          'SendToChain',
          {
            dstChainId: dstChainId.toString(),
            to: receiver.toString().toLowerCase(),
            qty: amountIn.toString(),
          }
        );

        await expectEvent.inTransaction(
          receipt.tx,
          this.stargateWidget,
          'PartnerSwap',
          { partnerId: stargateFormat(PARTNER_ID) }
        );
        profileGas(receipt);
      });

      // chain
      it('should revert: to unknown chain', async function () {
        // Prep
        const dstChainId = STARGATE_UNKNOWN_CHAIN_ID;
        const to = this.hStargate.address;
        const fee = ether('1'); // Use fixed fee because of unknown chain id
        const data = abi.simpleEncode(
          'sendTokens(uint16,address,uint256,uint256,uint256)',
          dstChainId,
          receiver,
          amountIn,
          fee,
          dstGas
        );

        // Execute
        const value = fee;
        await expectRevert(
          this.proxy.execMock(to, data, {
            from: user,
            value: value,
          }),
          '0_HStargate_sendTokens: LayerZero: dstChainId does not exist'
        );
      });

      // fee
      it('should revert: insufficient fee', async function () {
        // Prep
        const to = this.hStargate.address;
        const fee = ether('0'); // Send zero fee
        const data = abi.simpleEncode(
          'sendTokens(uint16,address,uint256,uint256,uint256)',
          dstChainId,
          receiver,
          amountIn,
          fee,
          dstGas
        );

        // Execute
        const value = fee;
        await expectRevert(
          this.proxy.execMock(to, data, {
            from: user,
            value: value,
          }),
          '0_HStargate_sendTokens: LayerZero: not enough native for fees'
        );
      });

      // amount
      it('should revert: amountIn = 0', async function () {
        // Prep
        const amountIn = ether('0');
        const to = this.hStargate.address;
        const fees = await this.layerZeroEndpoint.estimateFees(
          dstChainId,
          this.inputToken.address,
          payload,
          false, // pay in zero
          adapterParam
        );
        const fee = fees[0];
        const data = abi.simpleEncode(
          'sendTokens(uint16,address,uint256,uint256,uint256)',
          dstChainId,
          receiver,
          amountIn,
          fee,
          dstGas
        );

        // Execute
        const value = fee;
        await expectRevert(
          this.proxy.execMock(to, data, {
            from: user,
            value: value,
          }),
          '0_HStargate_sendTokens: zero amountIn'
        );
      });

      // address
      it('should revert: to zero address', async function () {
        // Prep
        const receiver = constants.ZERO_ADDRESS;
        const receiverBytes = abi.solidityPack(['address'], [receiver]);
        const payload = abi.rawEncode(
          ['bytes', 'uint256'],
          [receiverBytes, amountIn]
        );
        const to = this.hStargate.address;
        const fees = await this.layerZeroEndpoint.estimateFees(
          dstChainId,
          this.inputToken.address,
          payload,
          false, // pay in zero
          adapterParam
        );
        const fee = fees[0];
        const data = abi.simpleEncode(
          'sendTokens(uint16,address,uint256,uint256,uint256)',
          dstChainId,
          receiver,
          amountIn,
          fee,
          dstGas
        );

        // Execute
        const value = fee;
        await expectRevert(
          this.proxy.execMock(to, data, {
            from: user,
            value: value,
          }),
          '0_HStargate_sendTokens: to zero address'
        );
      });

      // gas
      it('should revert: zero dstGas', async function () {
        // Prep
        const dstGas = ether('0');
        const to = this.hStargate.address;
        const fee = ether('1'); // Use fixed fee because of zero dstGas
        const data = abi.simpleEncode(
          'sendTokens(uint16,address,uint256,uint256,uint256)',
          dstChainId,
          receiver,
          amountIn,
          fee,
          dstGas
        );

        // Execute
        const value = fee;
        await expectRevert(
          this.proxy.execMock(to, data, {
            from: user,
            value: value,
          }),
          '0_HStargate_sendTokens: Relayer: gas too low'
        );
      });
    });
  });
});
