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
  getCostOutputToken,
} = require('@balancer-labs/sor');

const abi = require('ethereumjs-abi');
const utils = web3.utils;
const { expect } = require('chai');
const { BALANCER_EXCHANGE_PROXY } = require('./utils/constants');
const { evmRevert, evmSnapshot, profileGas } = require('./utils/utils');

const HBalancerExchange = artifacts.require('HBalancerExchange');
const Registry = artifacts.require('Registry');
const Proxy = artifacts.require('ProxyMock');
const IToken = artifacts.require('IERC20');
const IExchangeProxy = artifacts.require('IExchangeProxy');

contract('BalancerExchange', function([_, user]) {
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
  });

  beforeEach(async function() {
    id = await evmSnapshot();
  });

  afterEach(async function() {
    await evmRevert(id);
  });

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

  describe('Multihop swap', function() {
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
});

async function loadPathData(allPools, tokenIn, tokenOut) {
  tokenIn = tokenIn.toLowerCase();
  tokenOut = tokenOut.toLowerCase();

  let [, allPoolsNonZeroBalances] = filterAllPools(allPools);

  const directPools = await filterPoolsWithTokensDirect(
    allPoolsNonZeroBalances,
    tokenIn,
    tokenOut
  );

  let mostLiquidPoolsFirstHop, mostLiquidPoolsSecondHop, hopTokens;
  [
    mostLiquidPoolsFirstHop,
    mostLiquidPoolsSecondHop,
    hopTokens,
  ] = await filterPoolsWithTokensMultihop(
    allPoolsNonZeroBalances,
    tokenIn,
    tokenOut
  );

  let pools, pathData;
  [pools, pathData] = parsePoolData(
    directPools,
    tokenIn,
    tokenOut,
    mostLiquidPoolsFirstHop,
    mostLiquidPoolsSecondHop,
    hopTokens
  );

  return [pools, pathData];
}

async function findBestSwapsMulti(
  Pools,
  InputToken,
  OutputToken,
  swapType,
  swapAmount,
  maxPools,
  returnTokenCostPerPool
) {
  let [pools, pathData] = await loadPathData(Pools, InputToken, OutputToken);

  processedPools = pools;

  if (swapType === SwapMethods.EXACT_IN) {
    processedPaths = processPaths(pathData, pools, 'swapExactIn');
    epsOfInterest = processEpsOfInterestMultiHop(
      processedPaths,
      'swapExactIn',
      noPools
    );
  } else {
    processedPaths = processPaths(pathData, pools, 'swapExactOut');

    epsOfInterest = processEpsOfInterestMultiHop(
      processedPaths,
      'swapExactOut',
      noPools
    );
  }

  return smartOrderRouterMultiHopEpsOfInterest(
    JSON.parse(JSON.stringify(processedPools)),
    processedPaths,
    swapType,
    swapAmount,
    maxPools,
    returnTokenCostPerPool,
    epsOfInterest
  );
}
