const chainId = network.config.chainId;

if (chainId == 1 || chainId == 42161 || chainId == 10) {
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
  WRAPPED_NATIVE_TOKEN,
  DAI_TOKEN,
  WETH_TOKEN,
  UNISWAPV3_ROUTER,
  UNISWAPV3_QUOTER,
  USDT_TOKEN,
} = require('./utils/constants');
const {
  evmRevert,
  evmSnapshot,
  profileGas,
  getHandlerReturn,
  getCallData,
  getTokenProvider,
} = require('./utils/utils');

const FeeRuleRegistry = artifacts.require('FeeRuleRegistry');
const HUniswapV3 = artifacts.require('HUniswapV3');
const Registry = artifacts.require('Registry');
const Proxy = artifacts.require('ProxyMock');
const IToken = artifacts.require('IERC20');
const ISwapRouter = artifacts.require('ISwapRouter');
const IQuoter = artifacts.require('IQuoter');

contract('UniswapV3 Swap', function([_, user, someone]) {
  let id;
  const tokenAddress = DAI_TOKEN;
  const token2Address = USDT_TOKEN;

  let balanceUser;
  let balanceProxy;
  let tokenUser;
  let wethUser;
  let tokenProvider;

  before(async function() {
    tokenProvider = await getTokenProvider(tokenAddress);

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
    this.token2 = await IToken.at(token2Address);
    this.weth = await IToken.at(WETH_TOKEN);
  });

  beforeEach(async function() {
    id = await evmSnapshot();
    balanceUser = await tracker(user);
    balanceProxy = await tracker(this.proxy.address);
    tokenUser = await this.token.balanceOf.call(user);
    token2User = await this.token2.balanceOf.call(user);
    wethUser = await this.weth.balanceOf.call(user);
  });

  afterEach(async function() {
    await evmRevert(id);
  });

  describe('Exact input', function() {
    describe('Single path', function() {
      describe('Ether in', function() {
        it('normal', async function() {
          const value = ether('1');
          const to = this.hUniswapV3.address;
          // Set swap info
          const tokenIn = WETH_TOKEN;
          const tokenOut = tokenAddress;
          const fee = new BN('3000');
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

          // Verify result
          expect(handlerReturn).to.be.bignumber.eq(result);
          expect(handlerReturn).to.be.bignumber.gt(new BN('0'));
          expect(await this.token.balanceOf.call(user)).to.be.bignumber.eq(
            tokenUser.add(result)
          );
          expect(
            await this.token.balanceOf.call(this.proxy.address)
          ).to.be.bignumber.eq(ether('0'));
          expect(await balanceProxy.delta()).to.be.bignumber.eq(ether('0'));
          expect(await balanceUser.delta()).to.be.bignumber.eq(
            ether('0').sub(value)
          );
        });

        it('max amount', async function() {
          const value = ether('1');
          const to = this.hUniswapV3.address;
          // Set swap info
          const tokenIn = WETH_TOKEN;
          const tokenOut = tokenAddress;
          const fee = new BN('3000');
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

          // Verify result
          expect(handlerReturn).to.be.bignumber.eq(result);
          expect(handlerReturn).to.be.bignumber.gt(new BN('0'));
          expect(await this.token.balanceOf.call(user)).to.be.bignumber.eq(
            tokenUser.add(result)
          );
          expect(
            await this.token.balanceOf.call(this.proxy.address)
          ).to.be.bignumber.eq(ether('0'));
          expect(await balanceProxy.delta()).to.be.bignumber.eq(ether('0'));
          expect(await balanceUser.delta()).to.be.bignumber.eq(
            ether('0').sub(value)
          );
        });

        it('insufficient ether', async function() {
          const value = ether('1');
          const to = this.hUniswapV3.address;
          // Set swap info
          const tokenIn = WETH_TOKEN;
          const tokenOut = tokenAddress;
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
      });

      describe('Ether out', function() {
        it('normal', async function() {
          const value = ether('1');
          const to = this.hUniswapV3.address;
          // Set swap info
          const tokenIn = tokenAddress;
          const tokenOut = WETH_TOKEN;
          const fee = new BN('3000');
          const amountIn = value;
          const amountOutMinimum = new BN('1');
          const sqrtPriceLimitX96 = new BN('0');
          await this.token.transfer(this.proxy.address, amountIn, {
            from: tokenProvider,
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
          const userBalanceDelta = await balanceUser.delta();
          expect(handlerReturn).to.be.bignumber.gt(new BN('0'));
          expect(handlerReturn).to.be.bignumber.eq(result);
          expect(userBalanceDelta).to.be.bignumber.eq(
            ether('0').add(handlerReturn)
          );

          expect(await this.token.balanceOf.call(user)).to.be.bignumber.eq(
            tokenUser
          );
          expect(
            await this.token.balanceOf.call(this.proxy.address)
          ).to.be.bignumber.eq(ether('0'));
          expect(await balanceProxy.delta()).to.be.bignumber.eq(ether('0'));
        });

        it('max amount', async function() {
          const value = ether('1');
          const to = this.hUniswapV3.address;
          // Set swap info
          const tokenIn = tokenAddress;
          const tokenOut = WETH_TOKEN;
          const fee = new BN('3000');
          const amountIn = value;
          const amountOutMinimum = new BN('1');
          const sqrtPriceLimitX96 = new BN('0');
          await this.token.transfer(this.proxy.address, amountIn, {
            from: tokenProvider,
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
          const userBalanceDelta = await balanceUser.delta();
          expect(handlerReturn).to.be.bignumber.gt(new BN('0'));
          expect(handlerReturn).to.be.bignumber.eq(result);
          expect(userBalanceDelta).to.be.bignumber.eq(
            ether('0').add(handlerReturn)
          );

          expect(await this.token.balanceOf.call(user)).to.be.bignumber.eq(
            tokenUser
          );
          expect(
            await this.token.balanceOf.call(this.proxy.address)
          ).to.be.bignumber.eq(ether('0'));
          expect(await balanceProxy.delta()).to.be.bignumber.eq(ether('0'));
        });

        it('insuffient token', async function() {
          const value = ether('1');
          const to = this.hUniswapV3.address;
          // Set swap info
          const tokenIn = tokenAddress;
          const tokenOut = WETH_TOKEN;
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
            'HUniswapV3_exactInputSingle: STF'
          );
        });
      });

      describe('Token only', function() {
        it('normal', async function() {
          const value = ether('1');
          const to = this.hUniswapV3.address;
          // Set swap info
          const tokenIn = tokenAddress;
          const tokenOut = WETH_TOKEN;
          const fee = new BN('3000');
          const amountIn = value;
          const amountOutMinimum = new BN('1');
          const sqrtPriceLimitX96 = new BN('0');
          await this.token.transfer(this.proxy.address, amountIn, {
            from: tokenProvider,
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

          // Verify result
          expect(handlerReturn).to.be.bignumber.eq(result);
          expect(handlerReturn).to.be.bignumber.gt(new BN('0'));
          expect(await this.token.balanceOf.call(user)).to.be.bignumber.eq(
            tokenUser
          );
          expect(
            await this.token.balanceOf.call(this.proxy.address)
          ).to.be.bignumber.eq(ether('0'));
          expect(
            await this.weth.balanceOf.call(this.proxy.address)
          ).to.be.bignumber.eq(ether('0'));
          expect(await this.weth.balanceOf.call(user)).to.be.bignumber.eq(
            wethUser.add(result)
          );
          expect(await balanceUser.delta()).to.be.bignumber.eq(ether('0'));
        });

        it('max amount', async function() {
          const value = ether('1');
          const to = this.hUniswapV3.address;
          // Set swap info
          const tokenIn = tokenAddress;
          const tokenOut = WETH_TOKEN;
          const fee = new BN('3000');
          const amountIn = value;
          const amountOutMinimum = new BN('1');
          const sqrtPriceLimitX96 = new BN('0');
          await this.token.transfer(this.proxy.address, amountIn, {
            from: tokenProvider,
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

          // Verify result
          expect(handlerReturn).to.be.bignumber.eq(result);
          expect(handlerReturn).to.be.bignumber.gt(new BN('0'));
          expect(await this.token.balanceOf.call(user)).to.be.bignumber.eq(
            tokenUser
          );
          expect(
            await this.token.balanceOf.call(this.proxy.address)
          ).to.be.bignumber.eq(ether('0'));
          expect(
            await this.weth.balanceOf.call(this.proxy.address)
          ).to.be.bignumber.eq(ether('0'));
          expect(await this.weth.balanceOf.call(user)).to.be.bignumber.eq(
            wethUser.add(result)
          );
          expect(await balanceUser.delta()).to.be.bignumber.eq(ether('0'));
        });

        it('insufficient token', async function() {
          const value = ether('1');
          const to = this.hUniswapV3.address;
          // Set swap info
          const tokenIn = tokenAddress;
          const tokenOut = WETH_TOKEN;
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
            'HUniswapV3_exactInputSingle: STF'
          );
        });
      });
    });

    describe('Multi path', function() {
      describe('Ether in', function() {
        it('normal', async function() {
          const value = ether('1');
          const to = this.hUniswapV3.address;
          // Set swap info
          const tokens = [WETH_TOKEN, token2Address, tokenAddress];
          const fees = [new BN('3000'), new BN('500')];
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

          // Verify result
          expect(handlerReturn).to.be.bignumber.eq(result);
          expect(handlerReturn).to.be.bignumber.gt(new BN('0'));
          expect(await this.token.balanceOf.call(user)).to.be.bignumber.eq(
            tokenUser.add(result)
          );
          expect(
            await this.token.balanceOf.call(this.proxy.address)
          ).to.be.bignumber.eq(ether('0'));
          expect(await balanceProxy.delta()).to.be.bignumber.eq(ether('0'));
          expect(await balanceUser.delta()).to.be.bignumber.eq(
            ether('0').sub(value)
          );
        });

        it('max amount', async function() {
          const value = ether('1');
          const to = this.hUniswapV3.address;
          // Set swap info
          const tokens = [WETH_TOKEN, token2Address, tokenAddress];
          const fees = [new BN('3000'), new BN('500')];
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

          // Verify result
          expect(handlerReturn).to.be.bignumber.eq(result);
          expect(handlerReturn).to.be.bignumber.gt(new BN('0'));
          expect(await this.token.balanceOf.call(user)).to.be.bignumber.eq(
            tokenUser.add(result)
          );
          expect(
            await this.token.balanceOf.call(this.proxy.address)
          ).to.be.bignumber.eq(ether('0'));
          expect(await balanceProxy.delta()).to.be.bignumber.eq(ether('0'));
          expect(await balanceUser.delta()).to.be.bignumber.eq(
            ether('0').sub(value)
          );
        });

        it('insufficient ether', async function() {
          const value = ether('1');
          const to = this.hUniswapV3.address;
          // Set swap info
          const tokens = [WETH_TOKEN, token2Address, tokenAddress];
          const fees = [new BN('3000'), new BN('500')];
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
      });

      describe('Ether out', function() {
        it('normal', async function() {
          const value = ether('1');
          const to = this.hUniswapV3.address;
          // Set swap info
          const tokens = [tokenAddress, token2Address, WETH_TOKEN];
          const fees = [new BN('500'), new BN('3000')];
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
          const userBalanceDelta = await balanceUser.delta();
          expect(handlerReturn).to.be.bignumber.gt(new BN('0'));
          expect(handlerReturn).to.be.bignumber.eq(result);
          expect(userBalanceDelta).to.be.bignumber.eq(
            ether('0').add(handlerReturn)
          );

          expect(await this.token.balanceOf.call(user)).to.be.bignumber.eq(
            tokenUser
          );
          expect(
            await this.token.balanceOf.call(this.proxy.address)
          ).to.be.bignumber.eq(ether('0'));
          expect(await balanceProxy.delta()).to.be.bignumber.eq(ether('0'));
        });

        it('max amount', async function() {
          const value = ether('1');
          const to = this.hUniswapV3.address;
          // Set swap info
          const tokens = [tokenAddress, token2Address, WETH_TOKEN];
          const fees = [new BN('500'), new BN('3000')];
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
          const userBalanceDelta = await balanceUser.delta();
          expect(handlerReturn).to.be.bignumber.eq(result);
          expect(handlerReturn).to.be.bignumber.gt(new BN('0'));
          expect(userBalanceDelta).to.be.bignumber.eq(
            ether('0').add(handlerReturn)
          );

          expect(await this.token.balanceOf.call(user)).to.be.bignumber.eq(
            tokenUser
          );
          expect(
            await this.token.balanceOf.call(this.proxy.address)
          ).to.be.bignumber.eq(ether('0'));
          expect(await balanceProxy.delta()).to.be.bignumber.eq(ether('0'));
        });

        it('insufficient token', async function() {
          const value = ether('1');
          const to = this.hUniswapV3.address;
          // Set swap info
          const tokens = [tokenAddress, token2Address, WETH_TOKEN];
          const fees = [new BN('500'), new BN('3000')];
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
            'HUniswapV3_exactInput: STF'
          );
        });
      });

      describe('Token only', function() {
        it('normal', async function() {
          const value = ether('1');
          const to = this.hUniswapV3.address;
          // Set swap info
          const tokens = [tokenAddress, token2Address, WETH_TOKEN];
          const fees = [new BN('500'), new BN('3000')];
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

          // Verify result
          expect(handlerReturn).to.be.bignumber.eq(result);
          expect(handlerReturn).to.be.bignumber.gt(new BN('0'));
          expect(await this.token.balanceOf.call(user)).to.be.bignumber.eq(
            tokenUser
          );
          expect(
            await this.token.balanceOf.call(this.proxy.address)
          ).to.be.bignumber.eq(ether('0'));
          expect(
            await this.weth.balanceOf.call(this.proxy.address)
          ).to.be.bignumber.eq(ether('0'));
          expect(await this.weth.balanceOf.call(user)).to.be.bignumber.eq(
            wethUser.add(result)
          );
          expect(await balanceUser.delta()).to.be.bignumber.eq(ether('0'));
        });

        it('max amount', async function() {
          const value = ether('1');
          const to = this.hUniswapV3.address;
          // Set swap info
          const tokens = [tokenAddress, token2Address, WETH_TOKEN];
          const fees = [new BN('500'), new BN('3000')];
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

          // Verify result
          expect(handlerReturn).to.be.bignumber.eq(result);
          expect(handlerReturn).to.be.bignumber.gt(new BN('0'));
          expect(await this.token.balanceOf.call(user)).to.be.bignumber.eq(
            tokenUser
          );
          expect(
            await this.token.balanceOf.call(this.proxy.address)
          ).to.be.bignumber.eq(ether('0'));
          expect(
            await this.weth.balanceOf.call(this.proxy.address)
          ).to.be.bignumber.eq(ether('0'));
          expect(await this.weth.balanceOf.call(user)).to.be.bignumber.eq(
            wethUser.add(result)
          );
          expect(await balanceUser.delta()).to.be.bignumber.eq(ether('0'));
        });

        it('insufficient token', async function() {
          const value = ether('1');
          const to = this.hUniswapV3.address;
          // Set swap info
          const tokens = [tokenAddress, token2Address, WETH_TOKEN];
          const fees = [new BN('500'), new BN('3000')];
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
            'HUniswapV3_exactInput: STF'
          );
        });
      });
    });
  });

  describe('Exact output', function() {
    describe('Single path', function() {
      describe('Ether in', function() {
        it('normal', async function() {
          const value = ether('1');
          const to = this.hUniswapV3.address;
          // Set swap info
          const tokenIn = WETH_TOKEN;
          const tokenOut = tokenAddress;
          const fee = new BN('3000');
          const amountOut = ether('1000');
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

          // Verify result
          expect(handlerReturn).to.be.bignumber.eq(result);
          expect(await this.token.balanceOf.call(user)).to.be.bignumber.eq(
            tokenUser.add(amountOut)
          );
          expect(
            await this.token.balanceOf.call(this.proxy.address)
          ).to.be.bignumber.eq(ether('0'));
          expect(await balanceProxy.delta()).to.be.bignumber.eq(ether('0'));
          expect(await balanceUser.delta()).to.be.bignumber.eq(
            ether('0').sub(result)
          );
        });

        it('max amount', async function() {
          const value = ether('1');
          const to = this.hUniswapV3.address;
          // Set swap info
          const tokenIn = WETH_TOKEN;
          const tokenOut = tokenAddress;
          const fee = new BN('3000');
          const amountOut = ether('1000');
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
          expect(handlerReturn).to.be.bignumber.eq(result);
          expect(await this.token.balanceOf.call(user)).to.be.bignumber.eq(
            tokenUser.add(amountOut)
          );
          expect(
            await this.token.balanceOf.call(this.proxy.address)
          ).to.be.bignumber.eq(ether('0'));
          expect(await balanceProxy.delta()).to.be.bignumber.eq(ether('0'));
          expect(await balanceUser.delta()).to.be.bignumber.eq(
            ether('0').sub(result)
          );
        });

        it('desired amount too high', async function() {
          const value = ether('1');
          const to = this.hUniswapV3.address;
          // Set swap info
          const tokenIn = WETH_TOKEN;
          const tokenOut = tokenAddress;
          const fee = new BN('3000');
          const amountOut = ether('30000');
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
            'HUniswapV3_exactOutputSingle: STF'
          );
        });
      });

      describe('Ether out', function() {
        it('normal', async function() {
          const value = ether('1');
          const to = this.hUniswapV3.address;
          // Set swap info
          const tokenIn = tokenAddress;
          const tokenOut = WETH_TOKEN;
          const fee = new BN('3000');
          const amountOut = ether('1');
          const amountInMaximum = ether('10000');
          const sqrtPriceLimitX96 = new BN('0');
          await this.token.transfer(this.proxy.address, amountInMaximum, {
            from: tokenProvider,
          });
          await this.proxy.updateTokenMock(tokenAddress);

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
          const userBalanceDelta = await balanceUser.delta();
          expect(handlerReturn).to.be.bignumber.eq(result);
          expect(await this.token.balanceOf.call(user)).to.be.bignumber.eq(
            tokenUser.add(amountInMaximum).sub(result)
          );
          expect(
            await this.token.balanceOf.call(this.proxy.address)
          ).to.be.bignumber.eq(ether('0'));
          expect(await balanceProxy.delta()).to.be.bignumber.eq(ether('0'));
          expect(userBalanceDelta).to.be.bignumber.eq(amountOut);
        });

        it('max amount', async function() {
          const value = ether('1');
          const to = this.hUniswapV3.address;
          // Set swap info
          const tokenIn = tokenAddress;
          const tokenOut = WETH_TOKEN;
          const fee = new BN('3000');
          const amountOut = ether('1');
          const amountInMaximum = ether('10000');
          const sqrtPriceLimitX96 = new BN('0');
          await this.token.transfer(this.proxy.address, amountInMaximum, {
            from: tokenProvider,
          });
          await this.proxy.updateTokenMock(tokenAddress);

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
          const userBalanceDelta = await balanceUser.delta();
          expect(handlerReturn).to.be.bignumber.eq(result);
          expect(await this.token.balanceOf.call(user)).to.be.bignumber.eq(
            tokenUser.add(amountInMaximum).sub(result)
          );
          expect(
            await this.token.balanceOf.call(this.proxy.address)
          ).to.be.bignumber.eq(ether('0'));
          expect(await balanceProxy.delta()).to.be.bignumber.eq(ether('0'));
          expect(userBalanceDelta).to.be.bignumber.eq(amountOut);
        });

        it('desired amount too high', async function() {
          const value = ether('1');
          const to = this.hUniswapV3.address;
          // Set swap info
          const tokenIn = tokenAddress;
          const tokenOut = WETH_TOKEN;
          const fee = new BN('3000');
          const amountOut = ether('20');
          const amountInMaximum = ether('5000');
          const sqrtPriceLimitX96 = new BN('0');
          await this.token.transfer(this.proxy.address, amountInMaximum, {
            from: tokenProvider,
          });
          await this.proxy.updateTokenMock(tokenAddress);

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
            'HUniswapV3_exactOutputSingle: STF'
          );
        });
      });

      describe('Token only', function() {
        it('normal', async function() {
          const value = ether('1');
          const to = this.hUniswapV3.address;
          // Set swap info
          const tokenIn = tokenAddress;
          const tokenOut = WETH_TOKEN;
          const fee = new BN('3000');
          const amountOut = ether('1');
          const amountInMaximum = ether('10000');
          const sqrtPriceLimitX96 = new BN('0');
          await this.token.transfer(this.proxy.address, amountInMaximum, {
            from: tokenProvider,
          });
          await this.proxy.updateTokenMock(tokenAddress);

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

          // Verify result
          expect(handlerReturn).to.be.bignumber.eq(result);

          expect(await this.token.balanceOf.call(user)).to.be.bignumber.eq(
            tokenUser.add(amountInMaximum).sub(result)
          );
          expect(
            await this.token.balanceOf.call(this.proxy.address)
          ).to.be.bignumber.eq(ether('0'));
          expect(
            await this.weth.balanceOf.call(this.proxy.address)
          ).to.be.bignumber.eq(ether('0'));
          expect(await this.weth.balanceOf.call(user)).to.be.bignumber.eq(
            wethUser.add(amountOut)
          );
          expect(await balanceUser.delta()).to.be.bignumber.eq(ether('0'));
        });

        it('max amount', async function() {
          const value = ether('1');
          const to = this.hUniswapV3.address;
          // Set swap info
          const tokenIn = tokenAddress;
          const tokenOut = WETH_TOKEN;
          const fee = new BN('3000');
          const amountOut = ether('1');
          const amountInMaximum = ether('10000');
          const sqrtPriceLimitX96 = new BN('0');
          await this.token.transfer(this.proxy.address, amountInMaximum, {
            from: tokenProvider,
          });
          await this.proxy.updateTokenMock(tokenAddress);

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

          // Verify result
          expect(handlerReturn).to.be.bignumber.eq(result);

          expect(await this.token.balanceOf.call(user)).to.be.bignumber.eq(
            tokenUser.add(amountInMaximum).sub(result)
          );
          expect(
            await this.token.balanceOf.call(this.proxy.address)
          ).to.be.bignumber.eq(ether('0'));
          expect(
            await this.weth.balanceOf.call(this.proxy.address)
          ).to.be.bignumber.eq(ether('0'));
          expect(await this.weth.balanceOf.call(user)).to.be.bignumber.eq(
            wethUser.add(amountOut)
          );
          expect(await balanceUser.delta()).to.be.bignumber.eq(ether('0'));
        });

        it('desired amount too high', async function() {
          const value = ether('1');
          const to = this.hUniswapV3.address;
          // Set swap info
          const tokenIn = tokenAddress;
          const tokenOut = WETH_TOKEN;
          const fee = new BN('3000');
          const amountOut = ether('100');
          const amountInMaximum = ether('10000');
          const sqrtPriceLimitX96 = new BN('0');
          await this.token.transfer(this.proxy.address, amountInMaximum, {
            from: tokenProvider,
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
            'HUniswapV3_exactOutputSingle: STF'
          );
        });
      });
    });

    describe('Multi path', function() {
      describe('Ether in', function() {
        it('normal', async function() {
          const value = ether('1');
          const to = this.hUniswapV3.address;
          // Set swap info
          const tokens = [tokenAddress, token2Address, WETH_TOKEN];
          const fees = [new BN('500'), new BN('3000')];
          const path = encodePath(tokens, fees);
          const amountOut = ether('1000');
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

          // Verify result
          expect(handlerReturn).to.be.bignumber.eq(result);
          expect(await this.token.balanceOf.call(user)).to.be.bignumber.eq(
            tokenUser.add(amountOut)
          );
          expect(
            await this.token.balanceOf.call(this.proxy.address)
          ).to.be.bignumber.eq(ether('0'));
          expect(await balanceProxy.delta()).to.be.bignumber.eq(ether('0'));
          expect(await balanceUser.delta()).to.be.bignumber.eq(
            ether('0').sub(result)
          );
        });

        it('max amount', async function() {
          const value = ether('1');
          const to = this.hUniswapV3.address;
          // Set swap info
          const tokens = [tokenAddress, token2Address, WETH_TOKEN];
          const fees = [new BN('500'), new BN('3000')];
          const path = encodePath(tokens, fees);
          const amountOut = ether('1000');
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
          expect(handlerReturn).to.be.bignumber.eq(result);
          expect(await this.token.balanceOf.call(user)).to.be.bignumber.eq(
            tokenUser.add(amountOut)
          );
          expect(
            await this.token.balanceOf.call(this.proxy.address)
          ).to.be.bignumber.eq(ether('0'));
          expect(await balanceProxy.delta()).to.be.bignumber.eq(ether('0'));
          expect(await balanceUser.delta()).to.be.bignumber.eq(
            ether('0').sub(result)
          );
        });

        it('desired amount too high', async function() {
          const value = ether('0.25');
          const to = this.hUniswapV3.address;
          // Set swap info
          const tokens = [tokenAddress, token2Address, WETH_TOKEN];
          const fees = [new BN('500'), new BN('3000')];
          const path = encodePath(tokens, fees);
          const amountOut = ether('5000');
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
            'HUniswapV3_exactOutput: STF'
          );
        });
      });

      describe('Ether out', function() {
        it('normal', async function() {
          const value = ether('1');
          const to = this.hUniswapV3.address;
          // Set swap info
          const tokens = [WETH_TOKEN, token2Address, tokenAddress];
          const fees = [new BN('3000'), new BN('500')];
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
          const userBalanceDelta = await balanceUser.delta();
          expect(handlerReturn).to.be.bignumber.eq(result);
          expect(await this.token.balanceOf.call(user)).to.be.bignumber.eq(
            tokenUser.add(amountInMaximum).sub(result)
          );
          expect(
            await this.token.balanceOf.call(this.proxy.address)
          ).to.be.bignumber.eq(ether('0'));
          expect(await balanceProxy.delta()).to.be.bignumber.eq(ether('0'));
          expect(userBalanceDelta).to.be.bignumber.eq(amountOut);
        });

        it('max amount', async function() {
          const value = ether('1');
          const to = this.hUniswapV3.address;
          // Set swap info
          const tokens = [WETH_TOKEN, token2Address, tokenAddress];
          const fees = [new BN('3000'), new BN('500')];
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
          const userBalanceDelta = await balanceUser.delta();
          expect(handlerReturn).to.be.bignumber.eq(result);
          expect(await this.token.balanceOf.call(user)).to.be.bignumber.eq(
            tokenUser.add(amountInMaximum).sub(result)
          );
          expect(
            await this.token.balanceOf.call(this.proxy.address)
          ).to.be.bignumber.eq(ether('0'));
          expect(await balanceProxy.delta()).to.be.bignumber.eq(ether('0'));
          expect(userBalanceDelta).to.be.bignumber.eq(amountOut);
        });

        it('desired amount too high', async function() {
          const value = ether('1');
          const to = this.hUniswapV3.address;
          // Set swap info
          const tokens = [WETH_TOKEN, token2Address, tokenAddress];
          const fees = [new BN('3000'), new BN('500')];
          const path = encodePath(tokens, fees);
          const amountOut = ether('10');
          const amountInMaximum = ether('2500');
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
            'HUniswapV3_exactOutput: STF'
          );
        });
      });

      describe('Token only', function() {
        it('normal', async function() {
          const value = ether('1');
          const to = this.hUniswapV3.address;
          // Set swap info
          const tokens = [WETH_TOKEN, token2Address, tokenAddress];
          const fees = [new BN('3000'), new BN('500')];
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

          // Verify result
          expect(handlerReturn).to.be.bignumber.eq(result);

          expect(await this.token.balanceOf.call(user)).to.be.bignumber.eq(
            tokenUser.add(amountInMaximum).sub(result)
          );
          expect(
            await this.token.balanceOf.call(this.proxy.address)
          ).to.be.bignumber.eq(ether('0'));
          expect(
            await this.weth.balanceOf.call(this.proxy.address)
          ).to.be.bignumber.eq(ether('0'));
          expect(await this.weth.balanceOf.call(user)).to.be.bignumber.eq(
            wethUser.add(amountOut)
          );
          expect(await balanceUser.delta()).to.be.bignumber.eq(ether('0'));
        });

        it('max amount', async function() {
          const value = ether('1');
          const to = this.hUniswapV3.address;
          // Set swap info
          const tokens = [WETH_TOKEN, token2Address, tokenAddress];
          const fees = [new BN('3000'), new BN('500')];
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

          // Verify result
          expect(handlerReturn).to.be.bignumber.eq(result);

          expect(await this.token.balanceOf.call(user)).to.be.bignumber.eq(
            tokenUser.add(amountInMaximum).sub(result)
          );
          expect(
            await this.token.balanceOf.call(this.proxy.address)
          ).to.be.bignumber.eq(ether('0'));
          expect(
            await this.weth.balanceOf.call(this.proxy.address)
          ).to.be.bignumber.eq(ether('0'));
          expect(await this.weth.balanceOf.call(user)).to.be.bignumber.eq(
            wethUser.add(amountOut)
          );
          expect(await balanceUser.delta()).to.be.bignumber.eq(ether('0'));
        });

        it('desired amount too high', async function() {
          const value = ether('1');
          const to = this.hUniswapV3.address;
          // Set swap info
          const tokens = [WETH_TOKEN, token2Address, tokenAddress];
          const fees = [new BN('3000'), new BN('500')];
          const path = encodePath(tokens, fees);
          const amountOut = ether('20');
          const amountInMaximum = ether('5000');
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
            'HUniswapV3_exactOutput: STF'
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
