if (network.config.chainId == 137) {
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
  DAI_TOKEN,
  UNISWAPV3_ROUTER,
  UNISWAPV3_QUOTER,
  USDC_TOKEN,
  WMATIC_TOKEN,
  WETH_TOKEN,
  WRAPPED_NATIVE_TOKEN,
} = require('./utils/constants');

const {
  evmRevert,
  evmSnapshot,
  profileGas,
  getHandlerReturn,
  getCallData,
  tokenProviderSushi,
  getTokenProvider,
  mwei,
  expectEqWithinBps,
} = require('./utils/utils');

const HUniswapV3 = artifacts.require('HUniswapV3');
const Registry = artifacts.require('Registry');
const FeeRuleRegistry = artifacts.require('FeeRuleRegistry');
const Proxy = artifacts.require('ProxyMock');
const IToken = artifacts.require('IERC20');
const ISwapRouter = artifacts.require('ISwapRouter');
const IQuoter = artifacts.require('IQuoter');

contract('UniswapV3 Swap', function([_, user, someone]) {
  let id;
  const tokenAddress = DAI_TOKEN;
  const tokenBAddress = USDC_TOKEN;
  const tokenCAddress = WETH_TOKEN;

  let balanceUser;
  let balanceProxy;
  let tokenUser;
  let tokenBUser;
  let tokenCUser;
  let tokenProvider;
  let tokenProviderB;

  before(async function() {
    // Use pool from other swap to avoid lack of liquidity
    tokenProvider = await getTokenProvider(tokenAddress, tokenBAddress);
    tokenProviderB = await getTokenProvider(tokenCAddress, tokenBAddress);

    this.registry = await Registry.new();
    this.hUniswapV3 = await HUniswapV3.new(WRAPPED_NATIVE_TOKEN);
    await this.registry.register(
      this.hUniswapV3.address,
      utils.asciiToHex('UniswapV3')
    );
    this.router = await ISwapRouter.at(UNISWAPV3_ROUTER);
    this.quoter = await IQuoter.at(UNISWAPV3_QUOTER);
    this.feeRuleRegistry = await FeeRuleRegistry.new('0', _);
    this.proxy = await Proxy.new(
      this.registry.address,
      this.feeRuleRegistry.address
    );
    this.token = await IToken.at(tokenAddress);
    this.tokenB = await IToken.at(tokenBAddress);
    this.tokenC = await IToken.at(tokenCAddress);

    this.wmatic = await IToken.at(WMATIC_TOKEN);
  });

  beforeEach(async function() {
    id = await evmSnapshot();
    balanceUser = await tracker(user);
    balanceProxy = await tracker(this.proxy.address);
    tokenUser = await this.token.balanceOf.call(user);
    tokenBUser = await this.tokenB.balanceOf.call(user);
    tokenCUser = await this.tokenC.balanceOf.call(user);
    wmaticUser = await this.wmatic.balanceOf.call(user);
  });

  afterEach(async function() {
    await evmRevert(id);
  });

  describe('Matic to Token', function() {
    describe('Exact input', function() {
      describe('single path', function() {
        it('normal', async function() {
          const value = ether('1');
          const to = this.hUniswapV3.address;

          // Set swap info
          const tokenIn = WMATIC_TOKEN;
          const tokenOut = tokenBAddress;
          const fee = new BN('500'); // 0.05%
          const amountIn = value;
          const amountOutMinimum = new BN('1');
          const sqrtPriceLimitX96 = new BN('0');

          // Estimate result
          const result = await this.quoter.quoteExactInputSingle.call(
            tokenIn,
            tokenOut,
            fee,
            amountIn,
            sqrtPriceLimitX96
          );

          // Execution
          const data = getCallData(HUniswapV3, 'exactInputSingleFromEther', [
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

          // Verify
          await verifyExactInputFromEther(
            this.proxy.address,
            handlerReturn,
            result,
            user,
            value,
            this.tokenB,
            tokenBUser,
            balanceProxy,
            balanceUser
          );
        });

        it('max amount', async function() {
          const value = ether('1');
          const to = this.hUniswapV3.address;
          // Set swap info
          const tokenIn = WMATIC_TOKEN;
          const tokenOut = tokenBAddress;
          const fee = new BN('500'); // 0.05%;
          const amountIn = value;
          const amountOutMinimum = new BN('1');
          const sqrtPriceLimitX96 = new BN('0');

          // Estimate result
          const result = await this.quoter.quoteExactInputSingle.call(
            tokenIn,
            tokenOut,
            fee,
            amountIn,
            sqrtPriceLimitX96
          );

          // Execution
          const data = getCallData(HUniswapV3, 'exactInputSingleFromEther', [
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

          // Verify
          await verifyExactInputFromEther(
            this.proxy.address,
            handlerReturn,
            result,
            user,
            value,
            this.tokenB,
            tokenBUser,
            balanceProxy,
            balanceUser
          );
        });

        it('should revert: insufficient Matic', async function() {
          const value = ether('1');
          const to = this.hUniswapV3.address;

          // Set swap info
          const tokenOut = tokenBAddress;
          const fee = new BN('3000');
          const amountIn = value;
          const amountOutMinimum = new BN('1');
          const sqrtPriceLimitX96 = new BN('0');

          // Execution
          const data = getCallData(HUniswapV3, 'exactInputSingleFromEther', [
            tokenOut,
            fee,
            amountIn,
            amountOutMinimum,
            sqrtPriceLimitX96,
          ]);

          await expectRevert.unspecified(
            this.proxy.execMock(to, data, {
              from: user,
              value: value.div(new BN('2')),
            })
          );
        });

        it('should revert: desired amount too high', async function() {
          const value = ether('1');
          const to = this.hUniswapV3.address;

          // Set swap info
          const tokenOut = tokenBAddress;
          const fee = new BN('500'); // 0.05%
          const amountIn = value;
          const amountOutMinimum = mwei('100');
          const sqrtPriceLimitX96 = new BN('0');

          // Execution
          const data = getCallData(HUniswapV3, 'exactInputSingleFromEther', [
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
            '0_HUniswapV3_exactInputSingle: Too little received'
          );
        });
      });

      describe('multi-path', function() {
        it('normal', async function() {
          const value = ether('1');
          const to = this.hUniswapV3.address;

          // Set swap info
          const tokens = [WMATIC_TOKEN, tokenBAddress, tokenAddress];
          const fees = [new BN('500') /* 0.05% */, new BN('500') /* 0.05% */];
          const amountIn = value;
          const amountOutMinimum = new BN('1');
          const path = encodePath(tokens, fees);

          // Estimate result
          const result = await this.quoter.quoteExactInput.call(path, amountIn);

          // Execution
          const data = getCallData(HUniswapV3, 'exactInputFromEther', [
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

          // Verify
          await verifyExactInputFromEther(
            this.proxy.address,
            handlerReturn,
            result,
            user,
            value,
            this.token,
            tokenUser,
            balanceProxy,
            balanceUser
          );
        });

        it('max amount', async function() {
          const value = ether('1');
          const to = this.hUniswapV3.address;
          // Set swap info
          const tokens = [WMATIC_TOKEN, tokenBAddress, tokenAddress];
          const fees = [new BN('500') /* 0.05% */, new BN('500') /* 0.05% */];
          const amountIn = value;
          const amountOutMinimum = new BN('1');
          const path = encodePath(tokens, fees);

          // Estimate result
          const result = await this.quoter.quoteExactInput.call(path, amountIn);

          // Execution
          const data = getCallData(HUniswapV3, 'exactInputFromEther', [
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

          // Verify
          await verifyExactInputFromEther(
            this.proxy.address,
            handlerReturn,
            result,
            user,
            value,
            this.token,
            tokenUser,
            balanceProxy,
            balanceUser
          );
        });

        it('should revert: insufficient Matic', async function() {
          const value = ether('1');
          const to = this.hUniswapV3.address;
          // Set swap info
          const tokens = [WMATIC_TOKEN, tokenBAddress, tokenAddress];
          const fees = [new BN('500') /* 0.05% */, new BN('500') /* 0.05% */];
          const amountIn = value;
          const amountOutMinimum = new BN('1');
          const path = encodePath(tokens, fees);

          // Execution
          const data = getCallData(HUniswapV3, 'exactInputFromEther', [
            path,
            amountIn,
            amountOutMinimum,
          ]);

          await expectRevert.unspecified(
            this.proxy.execMock(to, data, {
              from: user,
              value: value.div(new BN('2')),
            })
          );
        });

        it('should revert: desired amount too high', async function() {
          const value = ether('1');
          const to = this.hUniswapV3.address;

          // Set swap info
          const tokens = [WMATIC_TOKEN, tokenBAddress, tokenAddress];
          const fees = [new BN('500') /* 0.05% */, new BN('500') /* 0.05% */];
          const amountIn = value;
          const amountOutMinimum = ether('100');
          const path = encodePath(tokens, fees);

          // Execution
          const data = getCallData(HUniswapV3, 'exactInputFromEther', [
            path,
            amountIn,
            amountOutMinimum,
          ]);

          await expectRevert(
            this.proxy.execMock(to, data, {
              from: user,
              value: value,
            }),
            '0_HUniswapV3_exactInput: Too little received'
          );
        });

        it('from non Matic token', async function() {
          const value = ether('1');
          const to = this.hUniswapV3.address;

          // Set swap info
          const tokens = [tokenCAddress, tokenBAddress, tokenAddress];
          const fees = [new BN('500') /* 0.05% */, new BN('500') /* 0.05% */];
          const amountIn = value;
          const amountOutMinimum = new BN('1');
          const path = encodePath(tokens, fees);

          await this.tokenC.transfer(this.proxy.address, amountIn, {
            from: tokenProviderB,
          });
          await this.proxy.updateTokenMock(this.tokenC.address);

          // Execution
          const data = getCallData(HUniswapV3, 'exactInputFromEther', [
            path,
            amountIn,
            amountOutMinimum,
          ]);

          await expectRevert(
            this.proxy.execMock(to, data, {
              from: user,
              value: value,
            }),
            '0_HUniswapV3_exactInputFromEther: Input not wrapped native token'
          );
        });
      });
    });

    describe('Exact output', function() {
      describe('single path', function() {
        it('normal', async function() {
          const value = ether('10');
          const to = this.hUniswapV3.address;

          // Set swap info
          const tokenIn = WMATIC_TOKEN;
          const tokenOut = tokenBAddress;
          const fee = new BN('500'); /* 0.05% */
          const amountOut = mwei('1');
          const amountInMaximum = value;
          const sqrtPriceLimitX96 = new BN('0');

          // Estimate result
          const result = await this.quoter.quoteExactOutputSingle.call(
            tokenIn,
            tokenOut,
            fee,
            amountOut,
            sqrtPriceLimitX96
          );

          // Execution
          const data = getCallData(HUniswapV3, 'exactOutputSingleFromEther', [
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

          // Verify
          await verifyExactOutputFromEther(
            this.proxy.address,
            handlerReturn,
            result,
            user,
            this.tokenB,
            amountOut,
            tokenBUser,
            balanceProxy,
            balanceUser
          );
        });

        it('max amount', async function() {
          const value = ether('10');
          const to = this.hUniswapV3.address;

          // Set swap info
          const tokenIn = WMATIC_TOKEN;
          const tokenOut = tokenBAddress;
          const fee = new BN('500'); /* 0.05% */
          const amountOut = mwei('1');
          const sqrtPriceLimitX96 = new BN('0');

          // Estimate result
          const result = await this.quoter.quoteExactOutputSingle.call(
            tokenIn,
            tokenOut,
            fee,
            amountOut,
            sqrtPriceLimitX96
          );

          // Execution
          const data = getCallData(HUniswapV3, 'exactOutputSingleFromEther', [
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

          // Verify
          await verifyExactOutputFromEther(
            this.proxy.address,
            handlerReturn,
            result,
            user,
            this.tokenB,
            amountOut,
            tokenBUser,
            balanceProxy,
            balanceUser
          );
        });

        it('should revert: insufficient Matic', async function() {
          const value = ether('1');
          const to = this.hUniswapV3.address;
          // Set swap info
          const tokenOut = tokenBAddress;
          const fee = new BN('500'); /* 0.05% */
          const amountOut = mwei('100000');
          const amountInMaximum = value;
          const sqrtPriceLimitX96 = new BN('0');

          // Execution
          const data = getCallData(HUniswapV3, 'exactOutputSingleFromEther', [
            tokenOut,
            fee,
            amountOut,
            amountInMaximum,
            sqrtPriceLimitX96,
          ]);

          await expectRevert.unspecified(
            this.proxy.execMock(to, data, {
              from: user,
              value: value.div(new BN('2')),
            })
          );
        });

        it('should revert: desired amount too high', async function() {
          const value = ether('1');
          const to = this.hUniswapV3.address;
          // Set swap info
          const tokenOut = tokenBAddress;
          const fee = new BN('500'); /* 0.05% */
          const amountOut = mwei('1000');
          const amountInMaximum = value;
          const sqrtPriceLimitX96 = new BN('0');

          // Execution
          const data = getCallData(HUniswapV3, 'exactOutputSingleFromEther', [
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
            '0_HUniswapV3_exactOutputSingle: STF'
          );
        });
      });

      describe('multi-path', function() {
        it('normal', async function() {
          const value = ether('1000');
          const to = this.hUniswapV3.address;

          // Set swap info
          // Path is in reverse order
          const tokens = [tokenAddress, tokenBAddress, WMATIC_TOKEN];
          const fees = [new BN('500') /* 0.05% */, new BN('500') /* 0.05% */];
          const path = encodePath(tokens, fees);
          const amountOut = ether('100');
          const amountInMaximum = value;

          // Estimate result
          const result = await this.quoter.quoteExactOutput.call(
            path,
            amountOut
          );

          // Execution
          const data = getCallData(HUniswapV3, 'exactOutputFromEther', [
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

          // Verify
          await verifyExactOutputFromEther(
            this.proxy.address,
            handlerReturn,
            result,
            user,
            this.token,
            amountOut,
            tokenUser,
            balanceProxy,
            balanceUser
          );
        });

        it('max amount', async function() {
          const value = ether('1000');
          const to = this.hUniswapV3.address;

          // Set swap info
          const tokens = [tokenAddress, tokenBAddress, WMATIC_TOKEN];
          const fees = [new BN('500') /* 0.05% */, new BN('500') /* 0.05% */];
          const path = encodePath(tokens, fees);
          const amountOut = ether('100');

          // Estimate result
          const result = await this.quoter.quoteExactOutput.call(
            path,
            amountOut
          );

          // Execution
          const data = getCallData(HUniswapV3, 'exactOutputFromEther', [
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

          // Verify
          await verifyExactOutputFromEther(
            this.proxy.address,
            handlerReturn,
            result,
            user,
            this.token,
            amountOut,
            tokenUser,
            balanceProxy,
            balanceUser
          );
        });

        it('should revert: desired amount too high', async function() {
          const value = ether('1');
          const to = this.hUniswapV3.address;

          // Set swap info
          const tokens = [tokenAddress, tokenBAddress, WMATIC_TOKEN];
          const fees = [new BN('500') /* 0.05% */, new BN('500') /* 0.05% */];
          const path = encodePath(tokens, fees);
          const amountOut = ether('2000');
          const amountInMaximum = value;

          // Execution
          const data = getCallData(HUniswapV3, 'exactOutputFromEther', [
            path,
            amountOut,
            amountInMaximum,
          ]);

          await expectRevert(
            this.proxy.execMock(to, data, {
              from: user,
              value: value,
            }),
            '0_HUniswapV3_exactOutput: STF'
          );
        });

        it('should revert: insufficient Matic', async function() {
          const value = ether('1');
          const to = this.hUniswapV3.address;

          // Set swap info
          const tokens = [tokenAddress, tokenBAddress, WMATIC_TOKEN];
          const fees = [new BN('500') /* 0.05% */, new BN('500') /* 0.05% */];
          const path = encodePath(tokens, fees);
          const amountOut = ether('200000');
          const amountInMaximum = value;

          // Execution
          const data = getCallData(HUniswapV3, 'exactOutputFromEther', [
            path,
            amountOut,
            amountInMaximum,
          ]);

          await expectRevert.unspecified(
            this.proxy.execMock(to, data, {
              from: user,
              value: value.div(new BN('2')),
            })
          );
        });
      });
    });
  });

  describe('Token to Matic', function() {
    describe('Exact input', function() {
      describe('single path', function() {
        it('normal', async function() {
          const value = mwei('1');
          const to = this.hUniswapV3.address;

          // Set swap info
          const tokenIn = tokenBAddress;
          const tokenOut = WMATIC_TOKEN;
          const fee = new BN('500'); // 0.05%
          const amountIn = value;
          const amountOutMinimum = new BN('1');
          const sqrtPriceLimitX96 = new BN('0');
          await this.tokenB.transfer(this.proxy.address, amountIn, {
            from: tokenProviderB,
          });
          await this.proxy.updateTokenMock(this.tokenB.address);

          // Estimate result
          const result = await this.quoter.quoteExactInputSingle.call(
            tokenIn,
            tokenOut,
            fee,
            amountIn,
            sqrtPriceLimitX96
          );

          // Execution
          const data = getCallData(HUniswapV3, 'exactInputSingleToEther', [
            tokenIn,
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

          await verifyExactInputToEther(
            this.proxy.address,
            handlerReturn,
            result,
            user,
            this.tokenB,
            tokenBUser,
            balanceProxy,
            balanceUser
          );
        });

        it('max amount', async function() {
          const value = mwei('1');
          const to = this.hUniswapV3.address;

          // Set swap info
          const tokenIn = tokenBAddress;
          const tokenOut = WMATIC_TOKEN;
          const fee = new BN('500'); // 0.05%
          const amountIn = value;
          const amountOutMinimum = new BN('1');
          const sqrtPriceLimitX96 = new BN('0');
          await this.tokenB.transfer(this.proxy.address, amountIn, {
            from: tokenProviderB,
          });
          await this.proxy.updateTokenMock(this.token.address);

          // Estimate result
          const result = await this.quoter.quoteExactInputSingle.call(
            tokenIn,
            tokenOut,
            fee,
            amountIn,
            sqrtPriceLimitX96
          );

          // Execution
          const data = getCallData(HUniswapV3, 'exactInputSingleToEther', [
            tokenIn,
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
          await verifyExactInputToEther(
            this.proxy.address,
            handlerReturn,
            result,
            user,
            this.tokenB,
            tokenBUser,
            balanceProxy,
            balanceUser
          );
        });

        it('should revert: insufficient token', async function() {
          const value = mwei('1');
          const to = this.hUniswapV3.address;

          // Set swap info
          const tokenIn = tokenBAddress;
          const fee = new BN('500'); // 0.05%
          const amountIn = value;
          const amountOutMinimum = ether('100');
          const sqrtPriceLimitX96 = new BN('0');
          await this.tokenB.transfer(
            this.proxy.address,
            amountIn.div(new BN('2')),
            {
              from: tokenProviderB,
            }
          );
          await this.proxy.updateTokenMock(this.tokenB.address);

          // Execution
          const data = getCallData(HUniswapV3, 'exactInputSingleToEther', [
            tokenIn,
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
            '0_HUniswapV3_exactInputSingle: STF'
          );
        });

        it('should revert: desired amount too high', async function() {
          const value = mwei('1');
          const to = this.hUniswapV3.address;

          // Set swap info
          const tokenIn = tokenBAddress;
          const fee = new BN('500'); // 0.05%
          const amountIn = value;
          const amountOutMinimum = ether('100');
          const sqrtPriceLimitX96 = new BN('0');
          await this.tokenB.transfer(this.proxy.address, amountIn, {
            from: tokenProviderB,
          });
          await this.proxy.updateTokenMock(this.tokenB.address);

          // Execution
          const data = getCallData(HUniswapV3, 'exactInputSingleToEther', [
            tokenIn,
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
            '0_HUniswapV3_exactInputSingle: Too little received'
          );
        });
      });

      describe('multi-path', function() {
        it('normal', async function() {
          const value = ether('1');
          const to = this.hUniswapV3.address;

          // Set swap info
          const tokens = [tokenAddress, tokenBAddress, WMATIC_TOKEN];
          const fees = [new BN('500') /* 0.05% */, new BN('500') /* 0.05% */];
          const path = encodePath(tokens, fees);
          const amountIn = value;
          const amountOutMinimum = new BN('1');
          await this.token.transfer(this.proxy.address, amountIn, {
            from: tokenProvider,
          });
          await this.proxy.updateTokenMock(this.token.address);

          // Estimate result
          const result = await this.quoter.quoteExactInput.call(path, amountIn);

          // Execution
          const data = getCallData(HUniswapV3, 'exactInputToEther', [
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
          await verifyExactInputToEther(
            this.proxy.address,
            handlerReturn,
            result,
            user,
            this.token,
            tokenUser,
            balanceProxy,
            balanceUser
          );
        });

        it('max amount', async function() {
          const value = ether('1');
          const to = this.hUniswapV3.address;

          // Set swap info
          const tokens = [tokenAddress, tokenBAddress, WMATIC_TOKEN];
          const fees = [new BN('500') /* 0.05% */, new BN('500') /* 0.05% */];
          const path = encodePath(tokens, fees);
          const amountIn = value;
          const amountOutMinimum = new BN('1');
          await this.token.transfer(this.proxy.address, amountIn, {
            from: tokenProvider,
          });
          await this.proxy.updateTokenMock(this.token.address);

          // Estimate result
          const result = await this.quoter.quoteExactInput.call(path, amountIn);

          // Execution
          const data = getCallData(HUniswapV3, 'exactInputToEther', [
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
          await verifyExactInputToEther(
            this.proxy.address,
            handlerReturn,
            result,
            user,
            this.token,
            tokenUser,
            balanceProxy,
            balanceUser
          );
        });

        it('should revert: insufficient token', async function() {
          const value = ether('1');
          const to = this.hUniswapV3.address;

          // Set swap info
          const tokens = [tokenAddress, tokenBAddress, WMATIC_TOKEN];
          const fees = [new BN('500') /* 0.05% */, new BN('500') /* 0.05% */];
          const path = encodePath(tokens, fees);
          const amountIn = value;
          const amountOutMinimum = ether('100');
          await this.token.transfer(
            this.proxy.address,
            amountIn.div(new BN('2')),
            {
              from: tokenProvider,
            }
          );
          await this.proxy.updateTokenMock(this.token.address);

          // Execution
          const data = getCallData(HUniswapV3, 'exactInputToEther', [
            path,
            amountIn,
            amountOutMinimum,
          ]);

          await expectRevert(
            this.proxy.execMock(to, data, {
              from: user,
              value: value,
            }),
            '0_HUniswapV3_exactInput: STF'
          );
        });

        it('should revert: desired amount too high', async function() {
          const value = ether('1');
          const to = this.hUniswapV3.address;

          // Set swap info
          const tokens = [tokenAddress, tokenBAddress, WMATIC_TOKEN];
          const fees = [new BN('500') /* 0.05% */, new BN('500') /* 0.05% */];
          const path = encodePath(tokens, fees);
          const amountIn = value;
          const amountOutMinimum = ether('100');
          await this.token.transfer(this.proxy.address, amountIn, {
            from: tokenProvider,
          });
          await this.proxy.updateTokenMock(this.token.address);

          // Execution
          const data = getCallData(HUniswapV3, 'exactInputToEther', [
            path,
            amountIn,
            amountOutMinimum,
          ]);

          await expectRevert(
            this.proxy.execMock(to, data, {
              from: user,
              value: value,
            }),
            '0_HUniswapV3_exactInput: Too little received'
          );
        });

        it('should revert: token out is not Matic', async function() {
          const value = ether('1');
          const to = this.hUniswapV3.address;

          // Set swap info
          const tokens = [tokenAddress, tokenBAddress, tokenCAddress];
          const fees = [new BN('500') /* 0.05% */, new BN('500') /* 0.05% */];
          const path = encodePath(tokens, fees);
          const amountIn = value;
          const amountOutMinimum = new BN('1');
          await this.token.transfer(this.proxy.address, amountIn, {
            from: tokenProvider,
          });
          await this.proxy.updateTokenMock(this.token.address);

          // Execution
          const data = getCallData(HUniswapV3, 'exactInputToEther', [
            path,
            amountIn,
            amountOutMinimum,
          ]);

          await expectRevert(
            this.proxy.execMock(to, data, {
              from: user,
              value: value,
            }),
            '0_HUniswapV3_exactInputToEther: Output not wrapped native token'
          );
        });
      });
    });

    describe('Exact output', function() {
      describe('single path', function() {
        it('normal', async function() {
          const value = ether('1');
          const to = this.hUniswapV3.address;

          // Set swap info
          const tokenIn = tokenBAddress;
          const tokenOut = WMATIC_TOKEN;
          const fee = new BN('500'); // 0.05%
          const amountOut = ether('1');
          const amountInMaximum = mwei('3000');
          const sqrtPriceLimitX96 = new BN('0');
          await this.tokenB.transfer(this.proxy.address, amountInMaximum, {
            from: tokenProviderB,
          });
          await this.proxy.updateTokenMock(tokenBAddress);

          // Estimate result
          const result = await this.quoter.quoteExactOutputSingle.call(
            tokenIn,
            tokenOut,
            fee,
            amountOut,
            sqrtPriceLimitX96
          );

          // Execution
          const data = getCallData(HUniswapV3, 'exactOutputSingleToEther', [
            tokenIn,
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
          await verifyExactOutputToEther(
            this.proxy.address,
            handlerReturn,
            result,
            user,
            this.tokenB,
            tokenBUser,
            amountInMaximum,
            amountOut,
            balanceProxy,
            balanceUser
          );
        });

        it('max amount', async function() {
          const value = ether('1');
          const to = this.hUniswapV3.address;

          // Set swap info
          const tokenIn = tokenBAddress;
          const tokenOut = WMATIC_TOKEN;
          const fee = new BN('500'); // 0.05%
          const amountOut = ether('1');
          const amountInMaximum = mwei('3000');
          const sqrtPriceLimitX96 = new BN('0');
          await this.tokenB.transfer(this.proxy.address, amountInMaximum, {
            from: tokenProviderB,
          });
          await this.proxy.updateTokenMock(tokenBAddress);

          // Estimate result
          const result = await this.quoter.quoteExactOutputSingle.call(
            tokenIn,
            tokenOut,
            fee,
            amountOut,
            sqrtPriceLimitX96
          );

          // Execution
          const data = getCallData(HUniswapV3, 'exactOutputSingleToEther', [
            tokenIn,
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
          await verifyExactOutputToEther(
            this.proxy.address,
            handlerReturn,
            result,
            user,
            this.tokenB,
            tokenBUser,
            amountInMaximum,
            amountOut,
            balanceProxy,
            balanceUser
          );
        });

        it('should revert: desired amount too high', async function() {
          const value = ether('1');
          const to = this.hUniswapV3.address;

          // Set swap info
          const tokenIn = tokenBAddress;
          const fee = new BN('500'); // 0.05%
          const amountOut = ether('10000');
          const amountInMaximum = mwei('3000');
          const sqrtPriceLimitX96 = new BN('0');
          await this.tokenB.transfer(this.proxy.address, amountInMaximum, {
            from: tokenProviderB,
          });
          await this.proxy.updateTokenMock(tokenBAddress);

          // Execution
          const data = getCallData(HUniswapV3, 'exactOutputSingleToEther', [
            tokenIn,
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
            '0_HUniswapV3_exactOutputSingle: STF'
          );
        });
      });

      describe('multi-path', function() {
        it('normal', async function() {
          const value = ether('1');
          const to = this.hUniswapV3.address;

          // Set swap info
          const tokens = [WMATIC_TOKEN, tokenBAddress, tokenAddress];
          const fees = [new BN('500') /* 0.05% */, new BN('500') /* 0.05% */];
          const path = encodePath(tokens, fees);
          const amountOut = ether('1');
          const amountInMaximum = ether('10000');
          await this.token.transfer(this.proxy.address, amountInMaximum, {
            from: tokenProvider,
          });
          await this.proxy.updateTokenMock(tokenAddress);

          // Estimate result
          const result = await this.quoter.quoteExactOutput.call(
            path,
            amountOut
          );

          // Execution
          const data = getCallData(HUniswapV3, 'exactOutputToEther', [
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
          await verifyExactOutputToEther(
            this.proxy.address,
            handlerReturn,
            result,
            user,
            this.token,
            tokenUser,
            amountInMaximum,
            amountOut,
            balanceProxy,
            balanceUser
          );
        });

        it('max amount', async function() {
          const value = ether('1');
          const to = this.hUniswapV3.address;

          // Set swap info
          const tokens = [WMATIC_TOKEN, tokenBAddress, tokenAddress];
          const fees = [new BN('500') /* 0.05% */, new BN('500') /* 0.05% */];
          const path = encodePath(tokens, fees);
          const amountOut = ether('1');
          const amountInMaximum = ether('10000');
          await this.token.transfer(this.proxy.address, amountInMaximum, {
            from: tokenProvider,
          });
          await this.proxy.updateTokenMock(tokenAddress);

          // Estimate result
          const result = await this.quoter.quoteExactOutput.call(
            path,
            amountOut
          );

          // Execution
          const data = getCallData(HUniswapV3, 'exactOutputToEther', [
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
          await verifyExactOutputToEther(
            this.proxy.address,
            handlerReturn,
            result,
            user,
            this.token,
            tokenUser,
            amountInMaximum,
            amountOut,
            balanceProxy,
            balanceUser
          );
        });

        it('should revert: desired amount too high', async function() {
          const value = ether('1');
          const to = this.hUniswapV3.address;

          // Set swap info
          const tokens = [WMATIC_TOKEN, tokenBAddress, tokenAddress];
          const fees = [new BN('500') /* 0.05% */, new BN('500') /* 0.05% */];
          const path = encodePath(tokens, fees);
          const amountOut = ether('10000');
          const amountInMaximum = ether('10');
          await this.token.transfer(this.proxy.address, amountInMaximum, {
            from: tokenProvider,
          });
          await this.proxy.updateTokenMock(tokenAddress);

          // Execution
          const data = getCallData(HUniswapV3, 'exactOutputToEther', [
            path,
            amountOut,
            amountInMaximum,
          ]);

          await expectRevert(
            this.proxy.execMock(to, data, {
              from: user,
              value: value,
            }),
            '0_HUniswapV3_exactOutput: STF'
          );
        });

        it('should revert: tokenOut is not Matic', async function() {
          const value = ether('1');
          const to = this.hUniswapV3.address;

          // Set swap info
          const tokens = [tokenCAddress, tokenBAddress, tokenAddress];
          const fees = [new BN('500') /* 0.05% */, new BN('500') /* 0.05% */];
          const path = encodePath(tokens, fees);
          const amountOut = ether('10000');
          const amountInMaximum = ether('10');
          await this.token.transfer(this.proxy.address, amountInMaximum, {
            from: tokenProvider,
          });
          await this.proxy.updateTokenMock(tokenAddress);

          // Execution
          const data = getCallData(HUniswapV3, 'exactOutputToEther', [
            path,
            amountOut,
            amountInMaximum,
          ]);

          await expectRevert(
            this.proxy.execMock(to, data, {
              from: user,
              value: value,
            }),
            '0_HUniswapV3_exactOutputToEther: Output not wrapped native token'
          );
        });
      });
    });
  });

  describe('Token to Token', function() {
    describe('Exact input', function() {
      describe('single path', function() {
        it('normal', async function() {
          const value = ether('1');
          const to = this.hUniswapV3.address;

          // Set swap info
          const tokenIn = tokenBAddress;
          const tokenOut = tokenCAddress;
          const fee = new BN('500'); // 0.05%
          const amountIn = mwei('5000');
          const amountOutMinimum = new BN('1');
          const sqrtPriceLimitX96 = new BN('0');
          await this.tokenB.transfer(this.proxy.address, amountIn, {
            from: tokenProviderB,
          });
          await this.proxy.updateTokenMock(this.tokenB.address);

          // Estimate result
          const result = await this.quoter.quoteExactInputSingle.call(
            tokenIn,
            tokenOut,
            fee,
            amountIn,
            sqrtPriceLimitX96
          );

          // Execution
          const data = getCallData(HUniswapV3, 'exactInputSingle', [
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

          // Verify
          await verifyExactInput(
            this.proxy.address,
            handlerReturn,
            result,
            user,
            this.tokenB,
            tokenBUser,
            this.tokenC,
            tokenCUser,
            balanceUser
          );
        });

        it('max amount', async function() {
          const value = ether('1');
          const to = this.hUniswapV3.address;

          // Set swap info
          const tokenIn = tokenBAddress;
          const tokenOut = tokenCAddress;
          const fee = new BN('500'); // 0.05%
          const amountIn = mwei('5000');
          const amountOutMinimum = new BN('1');
          const sqrtPriceLimitX96 = new BN('0');
          await this.tokenB.transfer(this.proxy.address, amountIn, {
            from: tokenProviderB,
          });
          await this.proxy.updateTokenMock(this.tokenB.address);

          // Estimate result
          const result = await this.quoter.quoteExactInputSingle.call(
            tokenIn,
            tokenOut,
            fee,
            amountIn,
            sqrtPriceLimitX96
          );

          // Execution
          const data = getCallData(HUniswapV3, 'exactInputSingle', [
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

          // Verify
          await verifyExactInput(
            this.proxy.address,
            handlerReturn,
            result,
            user,
            this.token,
            tokenUser,
            this.tokenC,
            tokenCUser,
            balanceUser
          );
        });

        it('should revert: insufficient token', async function() {
          const value = ether('1');
          const to = this.hUniswapV3.address;

          // Set swap info
          const tokenIn = tokenBAddress;
          const tokenOut = tokenCAddress;
          const fee = new BN('500'); // 0.05%
          const amountIn = mwei('5000');
          const amountOutMinimum = new BN('1');
          const sqrtPriceLimitX96 = new BN('0');
          await this.tokenB.transfer(
            this.proxy.address,
            amountIn.div(new BN('2')),
            {
              from: tokenProvider,
            }
          );
          await this.proxy.updateTokenMock(this.tokenB.address);

          // Execution
          const data = getCallData(HUniswapV3, 'exactInputSingle', [
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
            '0_HUniswapV3_exactInputSingle: STF'
          );
        });

        it('should revert: desired amount too high', async function() {
          const value = ether('1');
          const to = this.hUniswapV3.address;

          // Set swap info
          const tokenIn = tokenBAddress;
          const tokenOut = tokenCAddress;
          const fee = new BN('500'); // 0.05%
          const amountIn = mwei('1');
          const amountOutMinimum = ether('1');
          const sqrtPriceLimitX96 = new BN('0');
          await this.tokenB.transfer(this.proxy.address, amountIn, {
            from: tokenProviderB,
          });
          await this.proxy.updateTokenMock(this.tokenB.address);

          // Execution
          const data = getCallData(HUniswapV3, 'exactInputSingle', [
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
            '0_HUniswapV3_exactInputSingle: Too little received'
          );
        });
      });

      describe('multi-path', function() {
        it('normal', async function() {
          const value = ether('1');
          const to = this.hUniswapV3.address;

          //   Set swap info
          const tokens = [tokenAddress, tokenBAddress, tokenCAddress];
          const fees = [new BN('500') /* 0.05% */, new BN('500') /* 0.05% */];
          const path = encodePath(tokens, fees);
          const amountIn = value;
          const amountOutMinimum = new BN('1');
          await this.token.transfer(this.proxy.address, amountIn, {
            from: tokenProvider,
          });
          await this.proxy.updateTokenMock(this.token.address);

          // Estimate result
          const result = await this.quoter.quoteExactInput.call(path, amountIn);

          // Execution
          const data = getCallData(HUniswapV3, 'exactInput', [
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

          // Verify
          await verifyExactInput(
            this.proxy.address,
            handlerReturn,
            result,
            user,
            this.token,
            tokenUser,
            this.tokenC,
            tokenCUser,
            balanceUser
          );
        });

        it('max amount', async function() {
          const value = ether('1');
          const to = this.hUniswapV3.address;

          //   Set swap info
          const tokens = [tokenAddress, tokenBAddress, tokenCAddress];
          const fees = [new BN('500') /* 0.05% */, new BN('500') /* 0.05% */];
          const path = encodePath(tokens, fees);
          const amountIn = value;
          const amountOutMinimum = new BN('1');
          await this.token.transfer(this.proxy.address, amountIn, {
            from: tokenProvider,
          });
          await this.proxy.updateTokenMock(this.token.address);

          // Estimate result
          const result = await this.quoter.quoteExactInput.call(path, amountIn);

          // Execution
          const data = getCallData(HUniswapV3, 'exactInput', [
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

          // Verify
          await verifyExactInput(
            this.proxy.address,
            handlerReturn,
            result,
            user,
            this.token,
            tokenUser,
            this.tokenC,
            tokenCUser,
            balanceUser
          );
        });

        it('should revert: insufficient token', async function() {
          const value = ether('1');
          const to = this.hUniswapV3.address;

          //   Set swap info
          const tokens = [tokenAddress, tokenBAddress, tokenCAddress];
          const fees = [new BN(500) /* 0.05% */, new BN(500) /* 0.05% */];
          const path = encodePath(tokens, fees);
          const amountIn = value;
          const amountOutMinimum = new BN('1');

          await this.token.transfer(
            this.proxy.address,
            amountIn.div(new BN('2')),
            {
              from: tokenProvider,
            }
          );
          await this.proxy.updateTokenMock(this.token.address);

          // Execution
          const data = getCallData(HUniswapV3, 'exactInput', [
            path,
            amountIn,
            amountOutMinimum,
          ]);

          await expectRevert(
            this.proxy.execMock(to, data, {
              from: user,
              value: value,
            }),
            '0_HUniswapV3_exactInput: STF'
          );
        });

        it('should revert: desired amount too high', async function() {
          const value = ether('1');
          const to = this.hUniswapV3.address;

          // Set swap info
          const tokens = [tokenAddress, tokenBAddress, tokenCAddress];
          const fees = [new BN(500) /* 0.05% */, new BN(500) /* 0.05% */];
          const path = encodePath(tokens, fees);
          const amountIn = value;
          const amountOutMinimum = ether('100');

          await this.token.transfer(this.proxy.address, amountIn, {
            from: tokenProvider,
          });
          await this.proxy.updateTokenMock(this.token.address);

          // Execution
          const data = getCallData(HUniswapV3, 'exactInput', [
            path,
            amountIn,
            amountOutMinimum,
          ]);

          await expectRevert(
            this.proxy.execMock(to, data, {
              from: user,
              value: value,
            }),
            '0_HUniswapV3_exactInput: Too little received'
          );
        });
      });
    });

    describe('Exact output', function() {
      describe('single path', function() {
        it('normal', async function() {
          const value = ether('1');
          const to = this.hUniswapV3.address;

          // Set swap info
          const tokenIn = tokenBAddress;
          const tokenOut = tokenCAddress;
          const fee = new BN('500'); // 0.05%
          const amountOut = ether('1');
          const amountInMaximum = mwei('10000');
          const sqrtPriceLimitX96 = new BN('0');
          await this.tokenB.transfer(this.proxy.address, amountInMaximum, {
            from: tokenProviderB,
          });
          await this.proxy.updateTokenMock(tokenBAddress);

          // Estimate result
          const result = await this.quoter.quoteExactOutputSingle.call(
            tokenIn,
            tokenOut,
            fee,
            amountOut,
            sqrtPriceLimitX96
          );

          // Execution
          const data = getCallData(HUniswapV3, 'exactOutputSingle', [
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

          // Verify
          await verifyExactOutput(
            this.proxy.address,
            handlerReturn,
            result,
            user,
            this.tokenB,
            amountInMaximum,
            tokenBUser,
            this.tokenC,
            amountOut,
            tokenCUser,
            balanceUser
          );
        });

        it('max amount', async function() {
          const value = ether('1');
          const to = this.hUniswapV3.address;

          // Set swap info
          const tokenIn = tokenBAddress;
          const tokenOut = tokenCAddress;
          const fee = new BN('500'); // 0.05%
          const amountOut = ether('1');
          const amountInMaximum = mwei('10000');
          const sqrtPriceLimitX96 = new BN('0');
          await this.tokenB.transfer(this.proxy.address, amountInMaximum, {
            from: tokenProviderB,
          });
          await this.proxy.updateTokenMock(tokenBAddress);

          // Estimate result
          const result = await this.quoter.quoteExactOutputSingle.call(
            tokenIn,
            tokenOut,
            fee,
            amountOut,
            sqrtPriceLimitX96
          );

          // Execution
          const data = getCallData(HUniswapV3, 'exactOutputSingle', [
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

          // Verify
          await verifyExactOutput(
            this.proxy.address,
            handlerReturn,
            result,
            user,
            this.tokenB,
            amountInMaximum,
            tokenBUser,
            this.tokenC,
            amountOut,
            tokenCUser,
            balanceUser
          );
        });

        it('should revert: insufficient token', async function() {
          const value = ether('1');
          const to = this.hUniswapV3.address;

          // Set swap info
          const tokenIn = tokenBAddress;
          const tokenOut = tokenCAddress;
          const fee = new BN('500'); // 0.05%
          const amountOut = ether('100');
          const amountInMaximum = mwei('10000');
          const sqrtPriceLimitX96 = new BN('0');
          await this.tokenB.transfer(
            this.proxy.address,
            amountInMaximum.div(new BN('2')),
            {
              from: tokenProviderB,
            }
          );
          await this.proxy.updateTokenMock(tokenAddress);

          // Execution
          const data = getCallData(HUniswapV3, 'exactOutputSingle', [
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
            '0_HUniswapV3_exactOutputSingle: STF'
          );
        });

        it('should revert: desired amount too high', async function() {
          const value = ether('1');
          const to = this.hUniswapV3.address;

          // Set swap info
          const tokenIn = tokenBAddress;
          const tokenOut = tokenCAddress;
          const fee = new BN('500'); // 0.05%
          const amountOut = ether('100');
          const amountInMaximum = mwei('10000');
          const sqrtPriceLimitX96 = new BN('0');
          await this.tokenB.transfer(this.proxy.address, amountInMaximum, {
            from: tokenProviderB,
          });
          await this.proxy.updateTokenMock(tokenAddress);

          // Execution
          const data = getCallData(HUniswapV3, 'exactOutputSingle', [
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
            '0_HUniswapV3_exactOutputSingle: STF'
          );
        });
      });

      describe('multi-path', function() {
        it('normal', async function() {
          const value = ether('1');
          const to = this.hUniswapV3.address;

          // Set swap info
          // Path is in reverse order
          const tokens = [tokenCAddress, tokenBAddress, tokenAddress];
          const fees = [new BN('500') /* 0.05% */, new BN('500') /* 0.05% */];
          const path = encodePath(tokens, fees);
          const amountOut = ether('1');
          const amountInMaximum = ether('10000');
          await this.token.transfer(this.proxy.address, amountInMaximum, {
            from: tokenProvider,
          });

          await this.proxy.updateTokenMock(tokenAddress);

          // Estimate result
          const result = await this.quoter.quoteExactOutput.call(
            path,
            amountOut
          );

          // Execution
          const data = getCallData(HUniswapV3, 'exactOutput', [
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

          // Verify
          await verifyExactOutput(
            this.proxy.address,
            handlerReturn,
            result,
            user,
            this.token,
            amountInMaximum,
            tokenUser,
            this.tokenC,
            amountOut,
            tokenCUser,
            balanceUser
          );
        });

        it('max amount', async function() {
          const value = ether('1');
          const to = this.hUniswapV3.address;

          // Set swap info
          const tokens = [tokenCAddress, tokenBAddress, tokenAddress];
          const fees = [new BN('500') /* 0.05% */, new BN('500') /* 0.05% */];
          const path = encodePath(tokens, fees);
          const amountOut = ether('1');
          const amountInMaximum = ether('10000');
          await this.token.transfer(this.proxy.address, amountInMaximum, {
            from: tokenProvider,
          });
          await this.proxy.updateTokenMock(tokenAddress);

          // Estimate result
          const result = await this.quoter.quoteExactOutput.call(
            path,
            amountOut
          );

          // Execution
          const data = getCallData(HUniswapV3, 'exactOutput', [
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

          // Verify
          await verifyExactOutput(
            this.proxy.address,
            handlerReturn,
            result,
            user,
            this.token,
            amountInMaximum,
            tokenUser,
            this.tokenC,
            amountOut,
            tokenCUser,
            balanceUser
          );
        });

        it('should revert: insufficient token', async function() {
          const value = ether('1');
          const to = this.hUniswapV3.address;

          // Set swap info
          const tokens = [tokenCAddress, tokenBAddress, tokenAddress];
          const fees = [new BN('500') /* 0.05% */, new BN('500') /* 0.05% */];
          const path = encodePath(tokens, fees);
          const amountOut = ether('100');
          const amountInMaximum = ether('10000');
          await this.token.transfer(
            this.proxy.address,
            amountInMaximum.div(new BN('2')),
            {
              from: tokenProvider,
            }
          );
          await this.proxy.updateTokenMock(tokenAddress);

          // Execution
          const data = getCallData(HUniswapV3, 'exactOutput', [
            path,
            amountOut,
            amountInMaximum,
          ]);

          await expectRevert(
            this.proxy.execMock(to, data, {
              from: user,
              value: value,
            }),
            '0_HUniswapV3_exactOutput: STF'
          );
        });

        it('should revert: desired amount too high', async function() {
          const value = ether('1');
          const to = this.hUniswapV3.address;

          // Set swap info
          const tokens = [tokenCAddress, tokenBAddress, tokenAddress];
          const fees = [new BN('500') /* 0.05% */, new BN('500') /* 0.05% */];
          const path = encodePath(tokens, fees);
          const amountOut = ether('100');
          const amountInMaximum = ether('10000');
          await this.token.transfer(this.proxy.address, amountInMaximum, {
            from: tokenProvider,
          });
          await this.proxy.updateTokenMock(tokenAddress);

          // Execution
          const data = getCallData(HUniswapV3, 'exactOutput', [
            path,
            amountOut,
            amountInMaximum,
          ]);

          await expectRevert(
            this.proxy.execMock(to, data, {
              from: user,
              value: value,
            }),
            '0_HUniswapV3_exactOutput: STF'
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

async function verifyExactInputFromEther(
  proxyAddress,
  tokenOutAmt,
  tokenOutExpAmt,
  user,
  tokenInAmt,
  tokenOut,
  tokenOutBeforeBalance,
  nativeTokenProxyBalance,
  nativeTokenUserBalance
) {
  // Verify if the amount of tokenOut is the same as pre-quote amount
  expect(tokenOutAmt).to.be.bignumber.eq(tokenOutExpAmt);

  // Verify if the amount of tokenOut is greater than 0
  expect(tokenOutAmt).to.be.bignumber.gt(new BN('0'));

  // Verify if user's remaining tokenOut balance is the same as calculated amount
  expect(await tokenOut.balanceOf.call(user)).to.be.bignumber.eq(
    tokenOutBeforeBalance.add(tokenOutExpAmt)
  );

  // Verify if proxy does not keep any tokenOut
  expect(await tokenOut.balanceOf.call(proxyAddress)).to.be.bignumber.eq(
    ether('0')
  );

  // Verify if proxy does not keep any native token
  expect(await nativeTokenProxyBalance.delta()).to.be.bignumber.eq(ether('0'));

  // Verify if user's native token balance is correct
  expect(await nativeTokenUserBalance.delta()).to.be.bignumber.eq(
    ether('0').sub(tokenInAmt)
  );
}

async function verifyExactInputToEther(
  proxyAddress,
  tokenOutAmt,
  tokenOutExpAmt,
  user,
  tokenIn,
  tokenInBeforeBalance,
  nativeTokenProxyBalance,
  nativeTokenUserBalance
) {
  // Verify if the amount of tokenOut is greater than 0
  expect(tokenOutAmt).to.be.bignumber.gt(new BN('0'));

  // Verify if the amount of tokenOut is the same as pre-quote amount
  expect(tokenOutAmt).to.be.bignumber.eq(tokenOutExpAmt);

  // Verify if native token amount is correct
  expect(await nativeTokenUserBalance.delta()).to.be.bignumber.eq(
    ether('0').add(tokenOutAmt)
  );

  // Verify if tokenIn is spent
  expect(await tokenIn.balanceOf.call(user)).to.be.bignumber.eq(
    tokenInBeforeBalance
  );

  // Verify if proxy does not keep any tokenOut
  expect(await tokenIn.balanceOf.call(proxyAddress)).to.be.bignumber.eq(
    ether('0')
  );

  // Verify if proxy does not keep any native token
  expect(await nativeTokenProxyBalance.delta()).to.be.bignumber.eq(ether('0'));
}

async function verifyExactOutputFromEther(
  proxyAddress,
  tokenInAmt,
  tokenInExpAmt,
  user,
  tokenOut,
  tokenOutAmt,
  tokenOutBeforeBalance,
  nativeTokenProxyBalance,
  nativeTokenUserBalance
) {
  // Verify if the amount of tokenIn is the same as pre-quote amount
  expect(tokenInAmt).to.be.bignumber.eq(tokenInExpAmt);

  // Verify if user's remaining tokenOut balance is the same as calculated amount
  expect(await tokenOut.balanceOf.call(user)).to.be.bignumber.eq(
    tokenOutBeforeBalance.add(tokenOutAmt)
  );

  // Verify if proxy does not keep any tokenOut
  expect(await tokenOut.balanceOf.call(proxyAddress)).to.be.bignumber.eq(
    ether('0')
  );
  // Verify if proxy does not keep any native token
  expect(await nativeTokenProxyBalance.delta()).to.be.bignumber.eq(ether('0'));

  // Verify if user's native token balance is correct
  expectEqWithinBps(
    ether('0').sub(await nativeTokenUserBalance.delta()),
    tokenInExpAmt,
    10
  );
}

async function verifyExactOutputToEther(
  proxyAddress,
  tokenInAmt,
  tokenInExpAmt,
  user,
  tokenIn,
  tokenInBeforeBalance,
  amountInMaximum,
  amountOut,
  nativeTokenProxyBalance,
  nativeTokenUserBalance
) {
  // Verify if the amount of tokenIn is the same as pre-quote amount
  expect(tokenInAmt).to.be.bignumber.eq(tokenInExpAmt);

  // Verify if user's remaining tokenIn balance is the same as calculated amount
  expect(await tokenIn.balanceOf.call(user)).to.be.bignumber.eq(
    tokenInBeforeBalance.add(amountInMaximum).sub(tokenInExpAmt)
  );

  // Verify if proxy does not keep any tokenIn
  expect(await tokenIn.balanceOf.call(proxyAddress)).to.be.bignumber.eq(
    ether('0')
  );

  // Verify if proxy does not keep any native token
  expect(await nativeTokenProxyBalance.delta()).to.be.bignumber.eq(ether('0'));

  // Verify if user's native token balance is correct
  expect(await nativeTokenUserBalance.delta()).to.be.bignumber.eq(amountOut);
}

async function verifyExactInput(
  proxyAddress,
  tokenOutAmt,
  tokenOutExpAmt,
  user,
  tokenIn,
  tokenInBeforeBalance,
  tokenOut,
  tokenOutBeforeBalance,
  nativeTokenUserBalance
) {
  // Verify if the amount of tokenOut is the same as pre-quote amount
  expect(tokenOutAmt).to.be.bignumber.eq(tokenOutExpAmt);

  // Verify if the amount of tokenOut is greater than 0
  expect(tokenOutAmt).to.be.bignumber.gt(new BN('0'));

  // Verify if user does spend all amount of tokenIn
  expect(await tokenIn.balanceOf.call(user)).to.be.bignumber.eq(
    tokenInBeforeBalance
  );

  // Verify if proxy swap all the tokenIn
  expect(await tokenIn.balanceOf.call(proxyAddress)).to.be.bignumber.eq(
    ether('0')
  );

  // Verify if proxy does not keep any tokenOut
  expect(await tokenOut.balanceOf.call(proxyAddress)).to.be.bignumber.eq(
    ether('0')
  );

  // Verify if user's tokenOut balance is correct
  expect(await tokenOut.balanceOf.call(user)).to.be.bignumber.eq(
    tokenOutBeforeBalance.add(tokenOutExpAmt)
  );

  // Verify if user's native token balance is correct
  expect(await nativeTokenUserBalance.delta()).to.be.bignumber.eq(ether('0'));
}

async function verifyExactOutput(
  proxyAddress,
  tokenInAmt,
  tokenInExpAmt,
  user,
  tokenIn,
  amountInMaximum,
  tokenInBeforeBalance,
  tokenOut,
  amountOut,
  tokenOutBeforeBalance,
  nativeTokenUserBalance
) {
  // Verify if the amount of tokenIn is the same as pre-quote amount
  expect(tokenInAmt).to.be.bignumber.eq(tokenInExpAmt);

  // Verify if user's remaining tokenIn balance is the same as calculated amount
  expect(await tokenIn.balanceOf.call(user)).to.be.bignumber.eq(
    tokenInBeforeBalance.add(amountInMaximum).sub(tokenInExpAmt)
  );

  // Verify if proxy does not keep any tokenIn
  expect(await tokenIn.balanceOf.call(proxyAddress)).to.be.bignumber.eq(
    ether('0')
  );

  // Verify if proxy does not keep any tokenOut
  expect(await tokenOut.balanceOf.call(proxyAddress)).to.be.bignumber.eq(
    ether('0')
  );

  // Verify if user's tokenOut balance is correct
  expect(await tokenOut.balanceOf.call(user)).to.be.bignumber.eq(
    tokenOutBeforeBalance.add(amountOut)
  );

  // Verify if user's native token balance is correct
  expect(await nativeTokenUserBalance.delta()).to.be.bignumber.eq(ether('0'));
}
