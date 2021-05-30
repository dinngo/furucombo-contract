const {
  balance,
  BN,
  constants,
  ether,
  expectEvent,
  expectRevert,
  time,
} = require('@openzeppelin/test-helpers');
const { tracker } = balance;
const { MAX_UINT256 } = constants;
const { latest } = time;
const abi = require('ethereumjs-abi');
const utils = web3.utils;
const { expect } = require('chai');
const {
  DAI_TOKEN,
  DAI_PROVIDER,
  BAT_TOKEN,
  WETH_TOKEN,
  UNISWAPV3_ROUTER,
  UNISWAPV3_QUOTER,
  HBTC_PROVIDER,
  HBTC_TOKEN,
  OMG_PROVIDER,
  OMG_TOKEN,
  USDT_TOKEN,
  USDT_PROVIDER,
} = require('./utils/constants');
const {
  evmRevert,
  evmSnapshot,
  mulPercent,
  profileGas,
  getHandlerReturn,
  getAbi,
  getCallData,
} = require('./utils/utils');

const HUniswapV3 = artifacts.require('HUniswapV3');
const Registry = artifacts.require('Registry');
const Proxy = artifacts.require('ProxyMock');
const IToken = artifacts.require('IERC20');
const ISwapRouter = artifacts.require('ISwapRouter');
const IQuoter = artifacts.require('IQuoter');
const IUsdt = artifacts.require('IERC20Usdt');

contract('UniswapV3 Swap', function([_, user, someone]) {
  let id;
  const slippage = new BN('3');
  const tokenAddress = DAI_TOKEN;
  const token2Address = USDT_TOKEN;
  const tokenProvider = DAI_PROVIDER;

  let balanceUser;
  let balanceProxy;
  let tokenUser;
  let token2User;
  let wethUser;

  before(async function() {
    this.registry = await Registry.new();
    this.hUniswapV3 = await HUniswapV3.new();
    await this.registry.register(
      this.hUniswapV3.address,
      utils.asciiToHex('UniswapV3')
    );
    this.router = await ISwapRouter.at(UNISWAPV3_ROUTER);
    this.quoter = await IQuoter.at(UNISWAPV3_QUOTER);
    this.proxy = await Proxy.new(this.registry.address);
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
          const amountOutMinimum = new BN('0');
          const sqrtPriceLimitX96 = new BN('0');

          // Estimate result
          const result = await this.quoter.quoteExactInputSingle.call(
            tokenIn,
            tokenOut,
            fee,
            amountIn,
            amountOutMinimum
          );

          // Execution
          const data = getCallData(HUniswapV3, 'exactInputSingleFromEther', [
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
          expect(await this.token.balanceOf.call(user)).to.be.bignumber.eq(
            tokenUser.add(result)
          );
          expect(
            await this.token.balanceOf.call(this.proxy.address)
          ).to.be.bignumber.eq(ether('0'));
          expect(await balanceProxy.delta()).to.be.bignumber.eq(ether('0'));
          expect(await balanceUser.delta()).to.be.bignumber.eq(
            ether('0')
              .sub(value)
              .sub(new BN(receipt.receipt.gasUsed))
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
          const amountOutMinimum = new BN('0');
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
            amountOutMinimum
          );

          // Execution
          const data = getCallData(HUniswapV3, 'exactInputSingleToEther', [
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
          const userBalanceDelta = await balanceUser.delta();

          expect(userBalanceDelta).to.be.bignumber.eq(
            ether('0')
              .add(handlerReturn)
              .sub(new BN(receipt.receipt.gasUsed))
          );

          expect(await this.token.balanceOf.call(user)).to.be.bignumber.eq(
            tokenUser
          );
          expect(
            await this.token.balanceOf.call(this.proxy.address)
          ).to.be.bignumber.eq(ether('0'));
          expect(await balanceProxy.delta()).to.be.bignumber.eq(ether('0'));
          expect(userBalanceDelta).to.be.bignumber.eq(
            ether('0')
              .add(result)
              .sub(new BN(receipt.receipt.gasUsed))
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
          const amountOutMinimum = new BN('0');
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
            amountOutMinimum
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
          const amountOutMinimum = new BN('0');
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
          expect(await this.token.balanceOf.call(user)).to.be.bignumber.eq(
            tokenUser.add(result)
          );
          expect(
            await this.token.balanceOf.call(this.proxy.address)
          ).to.be.bignumber.eq(ether('0'));
          expect(await balanceProxy.delta()).to.be.bignumber.eq(ether('0'));
          expect(await balanceUser.delta()).to.be.bignumber.eq(
            ether('0')
              .sub(value)
              .sub(new BN(receipt.receipt.gasUsed))
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
          const amountOutMinimum = new BN('0');
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

          expect(userBalanceDelta).to.be.bignumber.eq(
            ether('0')
              .add(handlerReturn)
              .sub(new BN(receipt.receipt.gasUsed))
          );

          expect(await this.token.balanceOf.call(user)).to.be.bignumber.eq(
            tokenUser
          );
          expect(
            await this.token.balanceOf.call(this.proxy.address)
          ).to.be.bignumber.eq(ether('0'));
          expect(await balanceProxy.delta()).to.be.bignumber.eq(ether('0'));
          expect(userBalanceDelta).to.be.bignumber.eq(
            ether('0')
              .add(result)
              .sub(new BN(receipt.receipt.gasUsed))
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
          const amountOutMinimum = new BN('0');
          const sqrtPriceLimitX96 = new BN('0');
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
            tokenUser.add(amountOut)
          );
          expect(
            await this.token.balanceOf.call(this.proxy.address)
          ).to.be.bignumber.eq(ether('0'));
          expect(await balanceProxy.delta()).to.be.bignumber.eq(ether('0'));
          expect(await balanceUser.delta()).to.be.bignumber.eq(
            ether('0')
              .sub(value)
              .sub(new BN(receipt.receipt.gasUsed))
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
          const userBalanceDelta = await balanceUser.delta();
          expect(handlerReturn).to.be.bignumber.eq(result);
          expect(await this.token.balanceOf.call(user)).to.be.bignumber.eq(
            tokenUser.add(amountInMaximum).sub(result)
          );
          expect(
            await this.token.balanceOf.call(this.proxy.address)
          ).to.be.bignumber.eq(ether('0'));
          expect(await balanceProxy.delta()).to.be.bignumber.eq(ether('0'));
          expect(userBalanceDelta).to.be.bignumber.eq(
            amountOut.sub(new BN(receipt.receipt.gasUsed))
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
          const amountOut = ether('2000');
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
            ether('0')
              .sub(value)
              .sub(new BN(receipt.receipt.gasUsed))
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
          expect(userBalanceDelta).to.be.bignumber.eq(
            amountOut.sub(new BN(receipt.receipt.gasUsed))
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
