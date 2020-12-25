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
const {
  filterPoolsWithTokensDirect,
  filterPoolsWithTokensMultihop,
  getTokenPairsMultiHop,
  parsePoolData,
  processPaths,
  processEpsOfInterestMultiHop,
  smartOrderRouterMultiHopEpsOfInterest,
  filterAllPools,
  formatSubgraphPools,
  getCostOutputToken,
  getAllPublicSwapPools,
} = require('@balancer-labs/sor');
const disabledTokens = require('./utils/disabled-tokens.json');
const multihopBatchSwapExactInAbi = require('./utils/abi/multihopBatchSwapExactIn.json');
const multihopBatchSwapExactOutAbi = require('./utils/abi/multihopBatchSwapExactOut.json');

const abi = web3.eth.abi;
const utils = web3.utils;
const bignumber = require('bignumber.js');
const { expect } = require('chai');
const {
  ETH_TOKEN,
  DAI_TOKEN,
  DAI_PROVIDER,
  WETH_TOKEN,
  WETH_PROVIDER,
  BALANCER_EXCHANGE_PROXY,
} = require('./utils/constants');
const {
  evmRevert,
  evmSnapshot,
  mulPercent,
  profileGas,
  getHandlerReturn,
} = require('./utils/utils');

const HBalancerExchange = artifacts.require('HBalancerExchange');
const Registry = artifacts.require('Registry');
const Proxy = artifacts.require('ProxyMock');
const IToken = artifacts.require('IERC20');
const IExchangeProxy = artifacts.require('IExchangeProxy');

contract('BalancerExchange', function([_, user]) {
  const slippage = new BN('3');
  let id;
  const token0 = DAI_TOKEN;
  const token1 = WETH_TOKEN;
  const token0Provider = DAI_PROVIDER;
  const token1Provider = WETH_PROVIDER;

  before(async function() {
    // Deploy proxy and handler
    this.registry = await Registry.new();
    this.proxy = await Proxy.new(this.registry.address);
    this.hBalancerExchange = await HBalancerExchange.new();
    await this.registry.register(
      this.hBalancerExchange.address,
      utils.asciiToHex('BalancerExchange')
    );
    this.exchange = await IExchangeProxy.at(BALANCER_EXCHANGE_PROXY);
    this.token0 = await IToken.at(token0);
    this.token1 = await IToken.at(token1);
  });

  beforeEach(async function() {
    id = await evmSnapshot();
  });

  afterEach(async function() {
    await evmRevert(id);
  });

  /*
  describe('Batch swap', function() {
    describe('Exact input', function() {
      describe('Ether to Token', function() {
        it('normal', async function() {});
      });

      describe('Token to Ether', function() {
        it('normal', async function() {});
      });

      describe('Token to Token', function() {
        it('normal', async function() {});
      });
    });

    describe('Exact output', function() {
      describe('Ether to Token', function() {
        it('normal', async function() {});
      });

      describe('Token to Ether', function() {
        it('normal', async function() {});
      });

      describe('Token to Token', function() {
        it('normal', async function() {});
      });
    });
  });
*/

  describe('Multihop swap', function() {
    let balanceUser;
    let balanceProxy;

    beforeEach(async function() {
      balanceUser = await tracker(user);
      balanceProxy = await tracker(this.proxy.address);
    });

    describe('Exact input', function() {
      const swapType = 'swapExactIn';
      const noPools = 4;
      describe('Ether to Token', function() {
        it('normal', async function() {
          const amount = ether('0.01');

          [, baseAmount] = await getPath(
            this.token1.address,
            this.token0.address,
            amount,
            0,
            noPools,
            swapType
          );

          const minAmount = mulPercent(baseAmount, new BN('100').sub(slippage));
          let swaps;
          let totalReturnWei;

          [swaps, totalReturnWei] = await getPath(
            this.token1.address,
            this.token0.address,
            amount,
            minAmount,
            noPools,
            swapType
          );

          const to = this.hBalancerExchange.address;
          const data = abi.encodeFunctionCall(multihopBatchSwapExactInAbi, [
            swaps,
            ETH_TOKEN,
            this.token0.address,
            amount.toString(),
            minAmount.toString(),
          ]);
          await balanceUser.get();
          const receipt = await this.proxy.execMock(to, data, {
            from: user,
            value: amount,
          });
          // Get handler return
          const handlerReturn = utils.toBN(
            getHandlerReturn(receipt, ['uint256'])[0]
          );
          expect(handlerReturn).to.be.bignumber.eq(
            await this.token0.balanceOf.call(user)
          );
          expect(await balanceProxy.get()).to.be.zero;
          expect(
            await this.token0.balanceOf.call(this.proxy.address)
          ).to.be.zero;
          expect(await balanceUser.delta()).to.be.bignumber.eq(
            ether('0')
              .sub(amount)
              .sub(new BN(receipt.receipt.gasUsed))
          );
          expect(await this.token0.balanceOf.call(user)).to.be.bignumber.eq(
            totalReturnWei
          );
          profileGas(receipt);
        });

        it('max amount', async function() {
          const amount = ether('0.000001');

          [, baseAmount] = await getPath(
            this.token1.address,
            this.token0.address,
            amount,
            0,
            noPools,
            swapType
          );

          const minAmount = mulPercent(baseAmount, new BN('100').sub(slippage));
          let swaps;
          let totalReturnWei;

          [swaps, totalReturnWei] = await getPath(
            this.token1.address,
            this.token0.address,
            amount,
            minAmount,
            noPools,
            swapType
          );

          const to = this.hBalancerExchange.address;
          const data = abi.encodeFunctionCall(multihopBatchSwapExactInAbi, [
            swaps,
            ETH_TOKEN,
            this.token0.address,
            MAX_UINT256.toString(),
            minAmount.toString(),
          ]);
          await balanceUser.get();
          const receipt = await this.proxy.execMock(to, data, {
            from: user,
            value: amount,
          });
          // Get handler return
          const handlerReturn = utils.toBN(
            getHandlerReturn(receipt, ['uint256'])[0]
          );
          expect(handlerReturn).to.be.bignumber.eq(
            await this.token0.balanceOf.call(user)
          );
          expect(await balanceProxy.get()).to.be.zero;
          expect(
            await this.token0.balanceOf.call(this.proxy.address)
          ).to.be.zero;
          expect(await balanceUser.delta()).to.be.bignumber.eq(
            ether('0')
              .sub(amount)
              .sub(new BN(receipt.receipt.gasUsed))
          );
          expect(await this.token0.balanceOf.call(user)).to.be.bignumber.eq(
            totalReturnWei
          );
          profileGas(receipt);
        });
      });

      describe('Token to Ether', function() {
        it('normal', async function() {
          const amount = ether('1');
          [, baseAmount] = await getPath(
            this.token0.address,
            this.token1.address,
            amount,
            0,
            noPools,
            swapType
          );
          const minAmount = mulPercent(baseAmount, new BN('100').sub(slippage));
          let swaps;
          let totalReturnWei;
          [swaps, totalReturnWei] = await getPath(
            this.token0.address,
            this.token1.address,
            amount,
            minAmount,
            noPools,
            swapType
          );
          const to = this.hBalancerExchange.address;
          const data = abi.encodeFunctionCall(multihopBatchSwapExactInAbi, [
            swaps,
            this.token0.address,
            ETH_TOKEN,
            amount.toString(),
            minAmount.toString(),
          ]);
          await this.token0.transfer(this.proxy.address, amount, {
            from: token0Provider,
          });
          await this.proxy.updateTokenMock(this.token0.address);
          await balanceUser.get();
          const receipt = await this.proxy.execMock(to, data, {
            from: user,
            value: ether('0.1'),
          });

          // Check handler return amount
          const handlerReturn = utils.toBN(
            getHandlerReturn(receipt, ['uint256'])[0]
          );
          expect(handlerReturn).to.be.bignumber.eq(totalReturnWei);

          expect(await balanceProxy.get()).to.be.zero;
          expect(
            await this.token0.balanceOf.call(this.proxy.address)
          ).to.be.zero;
          expect(await this.token0.balanceOf.call(user)).to.be.zero;
          expect(await balanceUser.delta()).to.be.bignumber.eq(
            totalReturnWei.sub(new BN(receipt.receipt.gasUsed))
          );
          profileGas(receipt);
        });

        it('max amount', async function() {
          const amount = ether('0.00001');
          [, baseAmount] = await getPath(
            this.token0.address,
            this.token1.address,
            amount,
            0,
            noPools,
            swapType
          );
          const minAmount = mulPercent(baseAmount, new BN('100').sub(slippage));
          let swaps;
          let totalReturnWei;
          [swaps, totalReturnWei] = await getPath(
            this.token0.address,
            this.token1.address,
            amount,
            minAmount,
            noPools,
            swapType
          );
          const to = this.hBalancerExchange.address;
          const data = abi.encodeFunctionCall(multihopBatchSwapExactInAbi, [
            swaps,
            this.token0.address,
            ETH_TOKEN,
            MAX_UINT256.toString(),
            minAmount.toString(),
          ]);
          await this.token0.transfer(this.proxy.address, amount, {
            from: token0Provider,
          });
          await this.proxy.updateTokenMock(this.token0.address);
          await balanceUser.get();
          const receipt = await this.proxy.execMock(to, data, {
            from: user,
            value: ether('0.1'),
          });

          // Check handler return amount
          const handlerReturn = utils.toBN(
            getHandlerReturn(receipt, ['uint256'])[0]
          );
          expect(handlerReturn).to.be.bignumber.eq(totalReturnWei);

          expect(await balanceProxy.get()).to.be.zero;
          expect(
            await this.token0.balanceOf.call(this.proxy.address)
          ).to.be.zero;
          expect(await this.token0.balanceOf.call(user)).to.be.zero;
          expect(await balanceUser.delta()).to.be.bignumber.eq(
            totalReturnWei.sub(new BN(receipt.receipt.gasUsed))
          );
          profileGas(receipt);
        });
      });

      describe('Token to Token', function() {
        it('normal', async function() {
          const amount = ether('0.00001');
          [, baseAmount] = await getPath(
            this.token0.address,
            this.token1.address,
            amount,
            0,
            noPools,
            swapType
          );
          const minAmount = mulPercent(baseAmount, new BN('100').sub(slippage));
          let swaps;
          let totalReturnWei;
          [swaps, totalReturnWei] = await getPath(
            this.token0.address,
            this.token1.address,
            amount,
            minAmount,
            noPools,
            swapType
          );
          const to = this.hBalancerExchange.address;
          const data = abi.encodeFunctionCall(multihopBatchSwapExactInAbi, [
            swaps,
            this.token0.address,
            this.token1.address,
            amount.toString(),
            minAmount.toString(),
          ]);
          await this.token0.transfer(this.proxy.address, amount, {
            from: token0Provider,
          });
          await this.proxy.updateTokenMock(this.token0.address);
          const receipt = await this.proxy.execMock(to, data, {
            from: user,
            value: ether('0.1'),
          });

          // Check handler return amount
          const handlerReturn = utils.toBN(
            getHandlerReturn(receipt, ['uint256'])[0]
          );
          expect(handlerReturn).to.be.bignumber.eq(
            await this.token1.balanceOf.call(user)
          );

          expect(await balanceProxy.get()).to.be.zero;
          expect(
            await this.token0.balanceOf.call(this.proxy.address)
          ).to.be.zero;
          expect(
            await this.token1.balanceOf.call(this.proxy.address)
          ).to.be.zero;
          expect(await this.token0.balanceOf.call(user)).to.be.zero;
          expect(await this.token1.balanceOf.call(user)).to.be.bignumber.eq(
            totalReturnWei
          );
          profileGas(receipt);
        });

        it('max amount', async function() {
          const amount = ether('0.00001');
          [, baseAmount] = await getPath(
            this.token0.address,
            this.token1.address,
            amount,
            0,
            noPools,
            swapType
          );
          const minAmount = mulPercent(baseAmount, new BN('100').sub(slippage));
          let swaps;
          let totalReturnWei;
          [swaps, totalReturnWei] = await getPath(
            this.token0.address,
            this.token1.address,
            amount,
            minAmount,
            noPools,
            swapType
          );
          const to = this.hBalancerExchange.address;
          const data = abi.encodeFunctionCall(multihopBatchSwapExactInAbi, [
            swaps,
            this.token0.address,
            this.token1.address,
            MAX_UINT256.toString(),
            minAmount.toString(),
          ]);
          await this.token0.transfer(this.proxy.address, amount, {
            from: token0Provider,
          });
          await this.proxy.updateTokenMock(this.token0.address);
          const receipt = await this.proxy.execMock(to, data, {
            from: user,
            value: ether('0.1'),
          });

          // Check handler return amount
          const handlerReturn = utils.toBN(
            getHandlerReturn(receipt, ['uint256'])[0]
          );
          expect(handlerReturn).to.be.bignumber.eq(
            await this.token1.balanceOf.call(user)
          );

          expect(await balanceProxy.get()).to.be.zero;
          expect(
            await this.token0.balanceOf.call(this.proxy.address)
          ).to.be.zero;
          expect(
            await this.token1.balanceOf.call(this.proxy.address)
          ).to.be.zero;
          expect(await this.token0.balanceOf.call(user)).to.be.zero;
          expect(await this.token1.balanceOf.call(user)).to.be.bignumber.eq(
            totalReturnWei
          );
          profileGas(receipt);
        });
      });
    });

    describe('Exact output', function() {
      const swapType = 'swapExactOut';
      const noPools = 4;
      describe('Ether to Token', function() {
        it('normal', async function() {
          const amount = ether('0.01');

          [, baseAmount] = await getPath(
            this.token1.address,
            this.token0.address,
            amount,
            MAX_UINT256,
            noPools,
            swapType
          );

          const maxAmount = mulPercent(baseAmount, new BN('100').add(slippage));
          let swaps;
          let totalReturnWei;
          [swaps, totalReturnWei] = await getPath(
            this.token1.address,
            this.token0.address,
            amount,
            maxAmount,
            noPools,
            swapType
          );

          const to = this.hBalancerExchange.address;
          const data = abi.encodeFunctionCall(multihopBatchSwapExactOutAbi, [
            swaps,
            ETH_TOKEN,
            this.token0.address,
            maxAmount.toString(),
          ]);
          await balanceUser.get();
          const receipt = await this.proxy.execMock(to, data, {
            from: user,
            value: maxAmount,
          });

          // Check handler return amount
          const handlerReturn = utils.toBN(
            getHandlerReturn(receipt, ['uint256'])[0]
          );
          expect(handlerReturn).to.be.bignumber.eq(totalReturnWei);

          expect(await balanceProxy.get()).to.be.zero;
          expect(
            await this.token0.balanceOf.call(this.proxy.address)
          ).to.be.zero;
          expect(await balanceUser.delta()).to.be.bignumber.eq(
            ether('0')
              .sub(totalReturnWei)
              .sub(new BN(receipt.receipt.gasUsed))
          );
          expect(await this.token0.balanceOf.call(user)).to.be.bignumber.eq(
            amount
          );
          profileGas(receipt);
        });
      });

      describe('Token to Ether', function() {
        it('normal', async function() {
          const amount = ether('0.000001');
          [, baseAmount] = await getPath(
            this.token0.address,
            this.token1.address,
            amount,
            MAX_UINT256,
            noPools,
            swapType
          );
          const maxAmount = mulPercent(baseAmount, new BN('100').add(slippage));
          let swaps;
          let totalReturnWei;
          [swaps, totalReturnWei] = await getPath(
            this.token0.address,
            this.token1.address,
            amount,
            maxAmount,
            noPools,
            swapType
          );
          const to = this.hBalancerExchange.address;
          const data = abi.encodeFunctionCall(multihopBatchSwapExactOutAbi, [
            swaps,
            this.token0.address,
            ETH_TOKEN,
            maxAmount.toString(),
          ]);
          await this.token0.transfer(this.proxy.address, maxAmount, {
            from: token0Provider,
          });
          await this.proxy.updateTokenMock(this.token0.address);
          await balanceUser.get();
          const receipt = await this.proxy.execMock(to, data, {
            from: user,
            value: ether('0.1'),
          });

          // Check handler return amount
          const handlerReturn = utils.toBN(
            getHandlerReturn(receipt, ['uint256'])[0]
          );
          expect(handlerReturn).to.be.bignumber.eq(totalReturnWei);

          expect(await balanceProxy.get()).to.be.zero;
          expect(
            await this.token0.balanceOf.call(this.proxy.address)
          ).to.be.zero;
          expect(await this.token0.balanceOf.call(user)).to.be.bignumber.eq(
            maxAmount.sub(totalReturnWei)
          );
          expect(await balanceUser.delta()).to.be.bignumber.eq(
            amount.sub(new BN(receipt.receipt.gasUsed))
          );
          profileGas(receipt);
        });
      });

      describe('Token to Token', function() {
        it('normal', async function() {
          const amount = ether('0.0001');
          [, baseAmount] = await getPath(
            this.token0.address,
            this.token1.address,
            amount,
            MAX_UINT256,
            noPools,
            swapType
          );
          const maxAmount = mulPercent(baseAmount, new BN('100').add(slippage));
          let swaps;
          let totalReturnWei;
          [swaps, totalReturnWei] = await getPath(
            this.token0.address,
            this.token1.address,
            amount,
            maxAmount,
            noPools,
            swapType
          );
          const to = this.hBalancerExchange.address;
          const data = abi.encodeFunctionCall(multihopBatchSwapExactOutAbi, [
            swaps,
            this.token0.address,
            this.token1.address,
            maxAmount.toString(),
          ]);
          await this.token0.transfer(this.proxy.address, maxAmount, {
            from: token0Provider,
          });
          await this.proxy.updateTokenMock(this.token0.address);
          const receipt = await this.proxy.execMock(to, data, {
            from: user,
            value: ether('0.1'),
          });

          // Check handler return amount
          const handlerReturn = utils.toBN(
            getHandlerReturn(receipt, ['uint256'])[0]
          );
          expect(handlerReturn).to.be.bignumber.eq(totalReturnWei);

          expect(await balanceProxy.get()).to.be.zero;
          expect(
            await this.token0.balanceOf.call(this.proxy.address)
          ).to.be.zero;
          expect(
            await this.token1.balanceOf.call(this.proxy.address)
          ).to.be.zero;
          expect(await this.token0.balanceOf.call(user)).to.be.bignumber.eq(
            maxAmount.sub(totalReturnWei)
          );
          expect(await this.token1.balanceOf.call(user)).to.be.bignumber.eq(
            amount
          );
          profileGas(receipt);
        });
      });
    });
  });

  /*
  describe('Smart swap', function() {
    describe('Exact input', function() {
      describe('Ether to Token', function() {
        it('normal', async function() {});
      });

      describe('Token to Ether', function() {
        it('normal', async function() {});
      });

      describe('Token to Token', function() {
        it('normal', async function() {});
      });
    });

    describe('Exact output', function() {
      describe('Ether to Token', function() {
        it('normal', async function() {});
      });

      describe('Token to Ether', function() {
        it('normal', async function() {});
      });

      describe('Token to Token', function() {
        it('normal', async function() {});
      });
    });
  });
*/
});

function formatAndFilterPools(allPools, disabledTokens) {
  let allTokens = [];
  let allTokensSet = new Set();
  let allPoolsNonZeroBalances = { pools: [] };

  for (let pool of allPools.pools) {
    // Build list of non-zero balance pools
    // Only check first balance since AFAIK either all balances are zero or none are:
    if (pool.tokens.length != 0) {
      if (pool.tokens[0].balance != '0') {
        let tokens = [];
        pool.tokensList.forEach(token => {
          if (
            !disabledTokens.find(
              t =>
                utils.toChecksumAddress(t.address) ===
                utils.toChecksumAddress(token)
            )
          ) {
            tokens.push(token);
          }
        });

        if (tokens.length > 1) {
          allTokens.push(tokens.sort()); // Will add without duplicate
        }

        allPoolsNonZeroBalances.pools.push(pool);
      }
    }
  }

  allTokensSet = new Set(
    Array.from(new Set(allTokens.map(a => JSON.stringify(a))), json =>
      JSON.parse(json)
    )
  );

  // Formats Subgraph to wei/bnum format
  formatSubgraphPools(allPoolsNonZeroBalances);

  return [allTokensSet, allPoolsNonZeroBalances];
}

async function getPath(
  tokenIn,
  tokenOut,
  totalSwapAmount,
  costReturnToken,
  noPools,
  swapType
) {
  let allTokensSet;
  let allPoolsNonZeroBalances;
  const allPools = await getAllPublicSwapPools();

  [allTokensSet, allPoolsNonZeroBalances] = formatAndFilterPools(
    JSON.parse(JSON.stringify(allPools)),
    disabledTokens.tokens
  );

  const directPools = await filterPoolsWithTokensDirect(
    allPoolsNonZeroBalances.pools,
    tokenIn.toLowerCase(),
    tokenOut.toLowerCase(),
    { isOverRide: true, disabledTokens: disabledTokens.tokens }
  );

  let mostLiquidPoolsFirstHop, mostLiquidPoolsSecondHop, hopTokens;
  [
    mostLiquidPoolsFirstHop,
    mostLiquidPoolsSecondHop,
    hopTokens,
  ] = await filterPoolsWithTokensMultihop(
    allPoolsNonZeroBalances.pools,
    tokenIn.toLowerCase(),
    tokenOut.toLowerCase(),
    { isOverRide: true, disabledTokens: disabledTokens.tokens }
  );
  let pools, pathData;
  [pools, pathData] = parsePoolData(
    directPools,
    tokenIn.toLowerCase(),
    tokenOut.toLowerCase(),
    mostLiquidPoolsFirstHop,
    mostLiquidPoolsSecondHop,
    hopTokens
  );
  const paths = processPaths(pathData, pools, swapType);
  const epsOfInterest = processEpsOfInterestMultiHop(paths, swapType, noPools);

  let swaps;
  let totalReturnWei;
  [swaps, totalReturnWei] = smartOrderRouterMultiHopEpsOfInterest(
    JSON.parse(JSON.stringify(pools)),
    paths,
    swapType,
    new bignumber(totalSwapAmount),
    noPools,
    new bignumber(costReturnToken),
    epsOfInterest
  );
  return [swaps, utils.toBN(totalReturnWei)];
}
