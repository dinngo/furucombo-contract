const chainId = network.config.chainId;

if (chainId == 1088) {
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
} = require('@openzeppelin/test-helpers');
const { tracker } = balance;
const { MAX_UINT256 } = constants;
const utils = web3.utils;
const { expect } = require('chai');
const {
  NATIVE_TOKEN_ADDRESS,
  MAIA_ROUTER,
  MAIA_QUOTER,
  USDC_TOKEN,
  USDT_TOKEN,
} = require('./utils/constants');
const {
  evmRevert,
  evmSnapshot,
  profileGas,
  getHandlerReturn,
  getCallData,
  getTokenProvider,
  mwei,
} = require('./utils/utils');

const FeeRuleRegistry = artifacts.require('FeeRuleRegistry');
const HMaia = artifacts.require('HMaia');
const Registry = artifacts.require('Registry');
const Proxy = artifacts.require('ProxyMock');
const IToken = artifacts.require('IERC20');
const ISwapRouter = artifacts.require('ISwapRouter');
const IQuoter = artifacts.require('IQuoterV2');

contract('Maia Swap', function ([_, user, someone]) {
  let id;
  const tokenAddress = USDC_TOKEN;
  const token2Address = USDT_TOKEN;

  let balanceUser;
  let tokenUser;
  let nativeUser;
  let tokenProvider;

  before(async function () {
    tokenProvider = await getTokenProvider(tokenAddress, USDC_TOKEN, 3000);

    this.registry = await Registry.new();
    this.hMaia = await HMaia.new();
    await this.registry.register(this.hMaia.address, utils.asciiToHex('Maia'));
    this.router = await ISwapRouter.at(MAIA_ROUTER);
    this.quoter = await IQuoter.at(MAIA_QUOTER);
    this.feeRuleRegistry = await FeeRuleRegistry.new('0', _);
    this.proxy = await Proxy.new(
      this.registry.address,
      this.feeRuleRegistry.address
    );
    this.token = await IToken.at(tokenAddress);
    this.token2 = await IToken.at(token2Address);
    this.native = await IToken.at(NATIVE_TOKEN_ADDRESS);
  });

  beforeEach(async function () {
    id = await evmSnapshot();
    balanceUser = await tracker(user);
    tokenUser = await this.token.balanceOf.call(user);
    token2User = await this.token2.balanceOf.call(user);
    nativeUser = await this.native.balanceOf.call(user);
  });

  afterEach(async function () {
    await evmRevert(id);
  });

  describe('Exact input', function () {
    describe('Single path', function () {
      describe('Token only', function () {
        it('normal', async function () {
          const value = mwei('1');
          const to = this.hMaia.address;
          // Set swap info
          const tokenIn = tokenAddress;
          const tokenOut = NATIVE_TOKEN_ADDRESS;
          const fee = new BN('3000');
          const amountIn = value;
          const amountOutMinimum = new BN('1');
          const sqrtPriceLimitX96 = new BN('0');
          await this.token.transfer(this.proxy.address, amountIn, {
            from: tokenProvider,
          });
          await this.proxy.updateTokenMock(this.token.address);

          // Estimate result
          const result = await this.quoter.quoteExactInputSingle.call([
            tokenIn,
            tokenOut,
            amountIn,
            fee,
            sqrtPriceLimitX96,
          ]);

          // Execution
          const data = getCallData(HMaia, 'exactInputSingle', [
            tokenIn,
            tokenOut,
            fee,
            amountIn,
            amountOutMinimum,
            sqrtPriceLimitX96,
          ]);

          const receipt = await this.proxy.execMock(to, data, {
            from: user,
            value: value,
          });

          profileGas(receipt);

          const handlerReturn = utils.toBN(
            getHandlerReturn(receipt, ['uint256'])[0]
          );

          // Verify result
          expect(handlerReturn).to.be.bignumber.eq(result.amountOut);
          expect(handlerReturn).to.be.bignumber.gt(new BN('0'));
          expect(await this.token.balanceOf.call(user)).to.be.bignumber.eq(
            tokenUser
          );
          expect(
            await this.token.balanceOf.call(this.proxy.address)
          ).to.be.bignumber.eq(ether('0'));
          expect(
            await this.native.balanceOf.call(this.proxy.address)
          ).to.be.bignumber.eq(ether('0'));
          expect(await this.native.balanceOf.call(user)).to.be.bignumber.eq(
            nativeUser.add(result.amountOut)
          );
          expect(await balanceUser.delta()).to.be.bignumber.eq(ether('0'));
        });

        it('max amount', async function () {
          const value = mwei('1');
          const to = this.hMaia.address;
          // Set swap info
          const tokenIn = tokenAddress;
          const tokenOut = NATIVE_TOKEN_ADDRESS;
          const fee = new BN('3000');
          const amountIn = value;
          const amountOutMinimum = new BN('1');
          const sqrtPriceLimitX96 = new BN('0');
          await this.token.transfer(this.proxy.address, amountIn, {
            from: tokenProvider,
          });
          await this.proxy.updateTokenMock(this.token.address);

          // Estimate result
          const result = await this.quoter.quoteExactInputSingle.call([
            tokenIn,
            tokenOut,
            amountIn,
            fee,
            sqrtPriceLimitX96,
          ]);

          // Execution
          const data = getCallData(HMaia, 'exactInputSingle', [
            tokenIn,
            tokenOut,
            fee,
            MAX_UINT256,
            amountOutMinimum,
            sqrtPriceLimitX96,
          ]);

          const receipt = await this.proxy.execMock(to, data, {
            from: user,
            value: value,
          });

          profileGas(receipt);

          const handlerReturn = utils.toBN(
            getHandlerReturn(receipt, ['uint256'])[0]
          );

          // Verify result
          expect(handlerReturn).to.be.bignumber.eq(result.amountOut);
          expect(handlerReturn).to.be.bignumber.gt(new BN('0'));
          expect(await this.token.balanceOf.call(user)).to.be.bignumber.eq(
            tokenUser
          );
          expect(
            await this.token.balanceOf.call(this.proxy.address)
          ).to.be.bignumber.eq(ether('0'));
          expect(
            await this.native.balanceOf.call(this.proxy.address)
          ).to.be.bignumber.eq(ether('0'));
          expect(await this.native.balanceOf.call(user)).to.be.bignumber.eq(
            nativeUser.add(result.amountOut)
          );
          expect(await balanceUser.delta()).to.be.bignumber.eq(ether('0'));
        });

        it('insufficient token', async function () {
          const value = mwei('1');
          const to = this.hMaia.address;
          // Set swap info
          const tokenIn = tokenAddress;
          const tokenOut = NATIVE_TOKEN_ADDRESS;
          const fee = new BN('3000');
          const amountIn = value;
          const amountOutMinimum = new BN('1');
          const sqrtPriceLimitX96 = new BN('0');
          await this.token.transfer(
            this.proxy.address,
            amountIn.div(new BN('2')),
            {
              from: tokenProvider,
            }
          );
          await this.proxy.updateTokenMock(this.token.address);

          // Execution
          const data = getCallData(HMaia, 'exactInputSingle', [
            tokenIn,
            tokenOut,
            fee,
            amountIn,
            amountOutMinimum,
            sqrtPriceLimitX96,
          ]);

          await expectRevert(
            this.proxy.execMock(to, data, {
              from: user,
              value: value,
            }),
            'HMaia_exactInputSingle: STF'
          );
        });
      });
    });

    describe.skip('Multi path', function () {
      describe('Token only', function () {
        it('normal', async function () {
          const value = ether('0.1');
          const to = this.hMaia.address;
          // Set swap info
          const tokens = [token2Address, tokenAddress, NATIVE_TOKEN_ADDRESS];
          const fees = [new BN('100'), new BN('3000')];
          const path = encodePath(tokens, fees);
          const amountIn = value;
          const amountOutMinimum = new BN('1');
          await this.native.transfer(this.proxy.address, amountIn, {
            from: tokenProvider,
          });
          await this.proxy.updateTokenMock(this.native.address);

          // Estimate result
          const result = await this.quoter.quoteExactInput.call(path, amountIn);

          // Execution
          const data = getCallData(HMaia, 'exactInput', [
            path,
            amountIn,
            amountOutMinimum,
          ]);

          const receipt = await this.proxy.execMock(to, data, {
            from: user,
            value: value,
          });

          profileGas(receipt);

          const handlerReturn = utils.toBN(
            getHandlerReturn(receipt, ['uint256'])[0]
          );

          // Verify result
          expect(handlerReturn).to.be.bignumber.eq(result.amountOut);
          expect(handlerReturn).to.be.bignumber.gt(new BN('0'));
          expect(await this.native.balanceOf.call(user)).to.be.bignumber.eq(
            nativeUser
          );
          expect(
            await this.native.balanceOf.call(this.proxy.address)
          ).to.be.bignumber.eq(ether('0'));
          expect(
            await this.token2.balanceOf.call(this.proxy.address)
          ).to.be.bignumber.eq(ether('0'));
          expect(await this.token2.balanceOf.call(user)).to.be.bignumber.eq(
            token2User.add(result.amountOut)
          );
          expect(await balanceUser.delta()).to.be.bignumber.eq(ether('0'));
        });

        it('max amount', async function () {
          const value = ether('0.1');
          const to = this.hMaia.address;
          // Set swap info
          const tokens = [token2Address, tokenAddress, NATIVE_TOKEN_ADDRESS];
          const fees = [new BN('100'), new BN('3000')];
          const path = encodePath(tokens, fees);
          const amountIn = value;
          const amountOutMinimum = new BN('1');
          await this.native.transfer(this.proxy.address, amountIn, {
            from: tokenProvider,
          });
          await this.proxy.updateTokenMock(this.native.address);

          // Estimate result
          const result = await this.quoter.quoteExactInput.call(path, amountIn);

          // Execution
          const data = getCallData(HMaia, 'exactInput', [
            path,
            MAX_UINT256,
            amountOutMinimum,
          ]);

          const receipt = await this.proxy.execMock(to, data, {
            from: user,
            value: value,
          });

          profileGas(receipt);

          const handlerReturn = utils.toBN(
            getHandlerReturn(receipt, ['uint256'])[0]
          );

          // Verify result
          expect(handlerReturn).to.be.bignumber.eq(result.amountOut);
          expect(handlerReturn).to.be.bignumber.gt(new BN('0'));
          expect(await this.native.balanceOf.call(user)).to.be.bignumber.eq(
            nativeUser
          );
          expect(
            await this.native.balanceOf.call(this.proxy.address)
          ).to.be.bignumber.eq(ether('0'));
          expect(
            await this.token2.balanceOf.call(this.proxy.address)
          ).to.be.bignumber.eq(ether('0'));
          expect(await this.token2.balanceOf.call(user)).to.be.bignumber.eq(
            token2User.add(result.amountOut)
          );
          expect(await balanceUser.delta()).to.be.bignumber.eq(ether('0'));
        });

        it('insufficient token', async function () {
          const value = ether('0.1');
          const to = this.hMaia.address;
          // Set swap info
          const tokens = [token2Address, tokenAddress, NATIVE_TOKEN_ADDRESS];
          const fees = [new BN('100'), new BN('3000')];
          const path = encodePath(tokens, fees);
          const amountIn = value;
          const amountOutMinimum = new BN('1');
          await this.native.transfer(
            this.proxy.address,
            amountIn.div(new BN('2')),
            {
              from: tokenProvider,
            }
          );
          await this.proxy.updateTokenMock(this.token.address);

          // Execution
          const data = getCallData(HMaia, 'exactInput', [
            path,
            amountIn,
            amountOutMinimum,
          ]);

          await expectRevert(
            this.proxy.execMock(to, data, {
              from: user,
              value: value,
            }),
            'HMaia_exactInput: STF'
          );
        });
      });
    });
  });

  describe('Exact output', function () {
    describe('Single path', function () {
      describe('Token only', function () {
        it('normal', async function () {
          const value = mwei('1');
          const to = this.hMaia.address;
          // Set swap info
          const tokenIn = tokenAddress;
          const tokenOut = NATIVE_TOKEN_ADDRESS;
          const fee = new BN('3000');
          const amountOut = ether('0.1');
          const amountInMaximum = mwei('10');
          const sqrtPriceLimitX96 = new BN('0');
          await this.token.transfer(this.proxy.address, amountInMaximum, {
            from: tokenProvider,
          });
          await this.proxy.updateTokenMock(tokenAddress);

          // Estimate result
          const result = await this.quoter.quoteExactOutputSingle.call([
            tokenIn,
            tokenOut,
            amountOut,
            fee,
            sqrtPriceLimitX96,
          ]);

          // Execution
          const data = getCallData(HMaia, 'exactOutputSingle', [
            tokenIn,
            tokenOut,
            fee,
            amountOut,
            amountInMaximum,
            sqrtPriceLimitX96,
          ]);

          const receipt = await this.proxy.execMock(to, data, {
            from: user,
            value: value,
          });

          profileGas(receipt);

          const handlerReturn = utils.toBN(
            getHandlerReturn(receipt, ['uint256'])[0]
          );

          // Verify result
          expect(handlerReturn).to.be.bignumber.eq(result.amountIn);

          expect(await this.token.balanceOf.call(user)).to.be.bignumber.eq(
            tokenUser.add(amountInMaximum).sub(result.amountIn)
          );
          expect(
            await this.token.balanceOf.call(this.proxy.address)
          ).to.be.bignumber.eq(ether('0'));
          expect(
            await this.native.balanceOf.call(this.proxy.address)
          ).to.be.bignumber.eq(ether('0'));
          expect(await this.native.balanceOf.call(user)).to.be.bignumber.eq(
            nativeUser.add(amountOut)
          );
          expect(await balanceUser.delta()).to.be.bignumber.eq(ether('0'));
        });

        it('max amount', async function () {
          const value = mwei('1');
          const to = this.hMaia.address;
          // Set swap info
          const tokenIn = tokenAddress;
          const tokenOut = NATIVE_TOKEN_ADDRESS;
          const fee = new BN('3000');
          const amountOut = ether('0.1');
          const amountInMaximum = mwei('10');
          const sqrtPriceLimitX96 = new BN('0');
          await this.token.transfer(this.proxy.address, amountInMaximum, {
            from: tokenProvider,
          });
          await this.proxy.updateTokenMock(tokenAddress);

          // Estimate result
          const result = await this.quoter.quoteExactOutputSingle.call([
            tokenIn,
            tokenOut,
            amountOut,
            fee,
            sqrtPriceLimitX96,
          ]);

          // Execution
          const data = getCallData(HMaia, 'exactOutputSingle', [
            tokenIn,
            tokenOut,
            fee,
            amountOut,
            MAX_UINT256,
            sqrtPriceLimitX96,
          ]);

          const receipt = await this.proxy.execMock(to, data, {
            from: user,
            value: value,
          });

          profileGas(receipt);

          const handlerReturn = utils.toBN(
            getHandlerReturn(receipt, ['uint256'])[0]
          );

          // Verify result
          expect(handlerReturn).to.be.bignumber.eq(result.amountIn);

          expect(await this.token.balanceOf.call(user)).to.be.bignumber.eq(
            tokenUser.add(amountInMaximum).sub(result.amountIn)
          );
          expect(
            await this.token.balanceOf.call(this.proxy.address)
          ).to.be.bignumber.eq(ether('0'));
          expect(
            await this.native.balanceOf.call(this.proxy.address)
          ).to.be.bignumber.eq(ether('0'));
          expect(await this.native.balanceOf.call(user)).to.be.bignumber.eq(
            nativeUser.add(amountOut)
          );
          expect(await balanceUser.delta()).to.be.bignumber.eq(ether('0'));
        });

        it('desired amount too high', async function () {
          const value = mwei('1');
          const to = this.hMaia.address;
          // Set swap info
          const tokenIn = tokenAddress;
          const tokenOut = NATIVE_TOKEN_ADDRESS;
          const fee = new BN('3000');
          const amountOut = ether('10');
          const amountInMaximum = mwei('10');
          const sqrtPriceLimitX96 = new BN('0');
          await this.token.transfer(this.proxy.address, amountInMaximum, {
            from: tokenProvider,
          });
          await this.proxy.updateTokenMock(tokenAddress);

          // Execution
          const data = getCallData(HMaia, 'exactOutputSingle', [
            tokenIn,
            tokenOut,
            fee,
            amountOut,
            amountInMaximum,
            sqrtPriceLimitX96,
          ]);

          await expectRevert(
            this.proxy.execMock(to, data, {
              from: user,
              value: value,
            }),
            'HMaia_exactOutputSingle: STF'
          );
        });
      });
    });

    describe('Multi path', function () {
      describe('Token only', function () {
        it('normal', async function () {
          const value = ether('0.1');
          const to = this.hMaia.address;
          // Set swap info
          const tokens = [token2Address, tokenAddress, NATIVE_TOKEN_ADDRESS];
          const fees = [new BN('100'), new BN('3000')];
          const path = encodePath(tokens, fees);
          const amountOut = mwei('1');
          const amountInMaximum = ether('0.1');
          await this.native.transfer(this.proxy.address, amountInMaximum, {
            from: tokenProvider,
          });
          await this.proxy.updateTokenMock(this.native.address);

          // Estimate result
          const result = await this.quoter.quoteExactOutput.call(
            path,
            amountOut
          );

          // Execution
          const data = getCallData(HMaia, 'exactOutput', [
            path,
            amountOut,
            amountInMaximum,
          ]);

          const receipt = await this.proxy.execMock(to, data, {
            from: user,
            value: value,
          });

          profileGas(receipt);

          const handlerReturn = utils.toBN(
            getHandlerReturn(receipt, ['uint256'])[0]
          );

          // Verify result
          expect(handlerReturn).to.be.bignumber.eq(result.amountIn);

          expect(await this.native.balanceOf.call(user)).to.be.bignumber.eq(
            nativeUser.add(amountInMaximum).sub(result.amountIn)
          );
          expect(
            await this.native.balanceOf.call(this.proxy.address)
          ).to.be.bignumber.eq(ether('0'));
          expect(
            await this.token2.balanceOf.call(this.proxy.address)
          ).to.be.bignumber.eq(ether('0'));
          expect(await this.token2.balanceOf.call(user)).to.be.bignumber.eq(
            token2User.add(amountOut)
          );
          expect(await balanceUser.delta()).to.be.bignumber.eq(ether('0'));
        });

        it('max amount', async function () {
          const value = ether('0.1');
          const to = this.hMaia.address;
          // Set swap info
          const tokens = [token2Address, tokenAddress, NATIVE_TOKEN_ADDRESS];
          const fees = [new BN('100'), new BN('3000')];
          const path = encodePath(tokens, fees);
          const amountOut = mwei('1');
          const amountInMaximum = ether('0.1');
          await this.native.transfer(this.proxy.address, amountInMaximum, {
            from: tokenProvider,
          });
          await this.proxy.updateTokenMock(this.native.address);

          // Estimate result
          const result = await this.quoter.quoteExactOutput.call(
            path,
            amountOut
          );

          // Execution
          const data = getCallData(HMaia, 'exactOutput', [
            path,
            amountOut,
            MAX_UINT256,
          ]);

          const receipt = await this.proxy.execMock(to, data, {
            from: user,
            value: value,
          });

          profileGas(receipt);

          const handlerReturn = utils.toBN(
            getHandlerReturn(receipt, ['uint256'])[0]
          );

          // Verify result
          expect(handlerReturn).to.be.bignumber.eq(result.amountIn);

          expect(await this.native.balanceOf.call(user)).to.be.bignumber.eq(
            nativeUser.add(amountInMaximum).sub(result.amountIn)
          );
          expect(
            await this.native.balanceOf.call(this.proxy.address)
          ).to.be.bignumber.eq(ether('0'));
          expect(
            await this.token2.balanceOf.call(this.proxy.address)
          ).to.be.bignumber.eq(ether('0'));
          expect(await this.token2.balanceOf.call(user)).to.be.bignumber.eq(
            token2User.add(amountOut)
          );
          expect(await balanceUser.delta()).to.be.bignumber.eq(ether('0'));
        });

        it('desired amount too high', async function () {
          const value = ether('0.1');
          const to = this.hMaia.address;
          // Set swap info
          const tokens = [token2Address, tokenAddress, NATIVE_TOKEN_ADDRESS];
          const fees = [new BN('100'), new BN('3000')];
          const path = encodePath(tokens, fees);
          const amountOut = mwei('20');
          const amountInMaximum = ether('0.1');
          await this.native.transfer(this.proxy.address, amountInMaximum, {
            from: tokenProvider,
          });
          await this.proxy.updateTokenMock(this.native.address);

          // Execution
          const data = getCallData(HMaia, 'exactOutput', [
            path,
            amountOut,
            amountInMaximum,
          ]);

          await expectRevert(
            this.proxy.execMock(to, data, {
              from: user,
              value: value,
            }),
            'HMaia_exactOutput: STF'
          );
        });
      });
    });
  });
});

function encodePath(path, fees) {
  if (path.length != fees.length + 1) {
    throw new Error('path/fee lengths do not match');
  }

  let encoded = '0x';
  for (let i = 0; i < fees.length; i++) {
    // 20 byte encoding of the address
    encoded += path[i].slice(2);
    // 3 byte encoding of the fee
    encoded += fees[i].toString(16).padStart(2 * 3, '0');
  }
  // encode the final token
  encoded += path[path.length - 1].slice(2);

  return encoded.toLowerCase();
}
