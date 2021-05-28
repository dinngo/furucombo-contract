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
  });

  beforeEach(async function() {
    id = await evmSnapshot();
  });

  afterEach(async function() {
    await evmRevert(id);
  });
  describe('Exact input', function() {
    const tokenAddress = DAI_TOKEN;

    let balanceUser;
    let balanceProxy;
    let token1User;

    before(async function() {
      this.token = await IToken.at(tokenAddress);
    });

    beforeEach(async function() {
      balanceUser = await tracker(user);
      balanceProxy = await tracker(this.proxy.address);
      tokenUser = await this.token.balanceOf.call(user);
    });

    describe('Single path', function() {
      describe('Ether in', function() {
        it('normal', async function() {
          const value = ether('1');
          const to = this.hUniswapV3.address;
          // Set swap info
          const tokenIn = WETH_TOKEN;
          const tokenOut = tokenAddress;
          const fee = new BN('3000');
          const recipient = this.proxy.address;
          const deadline = new BN('10000');
          const amountIn = value;
          const amountOutMinimum = new BN('0');
          const sqrtPriceLimitX96 = new BN('0');
          const params = [
            {
              tokenIn: tokenIn,
              tokenOut: tokenOut,
              fee: fee.toString(),
              recipient: recipient,
              deadline: deadline.toString(),
              amountIn: amountIn.toString(),
              amountOutMinimum: amountOutMinimum.toString(),
              sqrtPriceLimitX96: sqrtPriceLimitX96.toString(),
            },
          ];

          // Estimate result
          const result = await this.quoter.quoteExactInputSingle.call(
            tokenIn,
            tokenOut,
            fee,
            amountIn,
            amountOutMinimum
          );

          // Executioin
          const data = getCallData(
            HUniswapV3,
            'exactInputSingleFromEther',
            params
          );

          const receipt = await this.proxy.execMock(to, data, {
            from: user,
            value: value,
          });

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
              .sub(ether('1'))
              .sub(new BN(receipt.receipt.gasUsed))
          );
          profileGas(receipt);
        });
      });

      describe('Ether out', function() {
        it('normal', async function() {});
      });

      describe('Token only', function() {
        it('normal', async function() {});
      });
    });

    describe('Multi path', function() {
      describe('Ether in', function() {
        it('normal', async function() {});
      });

      describe('Ether out', function() {
        it('normal', async function() {});
      });

      describe('Token only', function() {
        it('normal', async function() {});
      });
    });
  });

  describe('Exact output', function() {
    describe('Single path', function() {
      describe('Ether in', function() {
        it('normal', async function() {});
      });

      describe('Ether out', function() {
        it('normal', async function() {});
      });

      describe('Token only', function() {
        it('normal', async function() {});
      });
    });

    describe('Multi path', function() {
      describe('Ether in', function() {
        it('normal', async function() {});
      });

      describe('Ether out', function() {
        it('normal', async function() {});
      });

      describe('Token only', function() {
        it('normal', async function() {});
      });
    });
  });
});

/*
function encodePath(path: string[], fees: FeeAmount[]): string {
  if (path.length != fees.length + 1) {
    throw new Error('path/fee lengths do not match');
  }

  let encoded = '0x';
  for (let i = 0; i < fees.length; i++) {
    // 20 byte encoding of the address
    encoded += path[i].slice(2);
    // 3 byte encoding of the fee
    encoded += fees[i].toString(16).padStart(2 * FEE_SIZE, '0');
  }
  // encode the final token
  encoded += path[path.length - 1].slice(2);

  return encoded.toLowerCase();
}
*/
