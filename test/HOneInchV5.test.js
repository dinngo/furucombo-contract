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
  ether,
  expectRevert,
} = require('@openzeppelin/test-helpers');
const { tracker } = balance;
const utils = web3.utils;
const { expect } = require('chai');
const {
  DAI_TOKEN,
  USDC_TOKEN,
  WETH_TOKEN,
  NATIVE_TOKEN_ADDRESS,
} = require('./utils/constants');
const {
  evmRevert,
  evmSnapshot,
  mulPercent,
  profileGas,
  getHandlerReturn,
  getFuncSig,
  getCallData,
  getTokenProvider,
  callExternalApi,
} = require('./utils/utils');
const queryString = require('query-string');

const FeeRuleRegistry = artifacts.require('FeeRuleRegistry');
const HOneInch = artifacts.require('HOneInchV5');
const Registry = artifacts.require('Registry');
const Proxy = artifacts.require('ProxyMock');
const IToken = artifacts.require('IERC20');
const IOneInch = artifacts.require('IAggregationRouterV5');

const SELECTOR_1INCH_SWAP = getFuncSig(IOneInch, 'swap');
const SELECTOR_1INCH_UNOSWAP = getFuncSig(IOneInch, 'unoswap');
const SELECTOR_1INCH_UNOSWAP_V3_SWAP = getFuncSig(IOneInch, 'uniswapV3Swap');

/// Change url for different chain
/// - Ethereum: https://api.1inch.exchange/v5.0/1/
/// - Polygon: https://api.1inch.exchange/v5.0/137/
const URL_1INCH = 'https://api.1inch.exchange/v5.0/' + chainId + '/';
const URL_1INCH_SWAP = URL_1INCH + 'swap';

const UNOSWAP_PROTOCOLS =
  chainId == 1
    ? [
        'SHIBASWAP',
        'SUSHI',
        'UNISWAP_V2',
        'PMM1', // cannot use PMMs without UNISWAP_V2
        'DEFISWAP',
        'SAKESWAP',
        'PMM2',
        'PMM3',
        'PMM4',
        'DXSWAP',
      ].join(',')
    : chainId == 10
    ? [''] // no unoswap protocols
    : chainId == 137
    ? [''] // no unoswap protocols
    : chainId == 42161
    ? [''] // no unoswap protocols
    : ['']; // no unoswap protocols // Avalanche
const NON_UNOSWAP_PROTOCOLS =
  chainId == 1
    ? [
        // comment out protocols would cause internal server error
        'UNISWAP_V1',
        'MOONISWAP',
        'BALANCER',
        // 'COMPOUND',
        'CURVE',
        // 'CURVE_V2_SPELL_2_ASSET',
        // 'CURVE_V2_SGT_2_ASSET',
        // 'CURVE_V2_THRESHOLDNETWORK_2_ASSET',
        // 'CHAI',
        'OASIS',
        'KYBER',
        // 'AAVE',
        // 'IEARN',
        'BANCOR',
        'SWERVE',
        'BLACKHOLESWAP',
        'DODO',
        'DODO_V2',
        // 'VALUELIQUID',
        'SHELL',
        'LUASWAP',
        'MINISWAP',
        'MSTABLE',
        // 'SYNTHETIX',
        // 'AAVE_V2',
        'ST_ETH',
        'ONE_INCH_LP',
        'ONE_INCH_LP_1_1',
        'LINKSWAP',
        'S_FINANCE',
        'PSM',
        // 'POWERINDEX',
        'XSIGMA',
        'SMOOTHY_FINANCE',
        'SADDLE',
        'KYBER_DMM',
        'BALANCER_V2',
        // 'SETH_WRAPPER',
        'CURVE_V2',
        // 'CURVE_V2_EURS_2_ASSET',
        'CURVE_V2_EURT_2_ASSET',
        'CURVE_V2_XAUT_2_ASSET',
        // 'CURVE_V2_ETH_CRV',
        // 'CURVE_V2_ETH_CVX',
        'CONVERGENCE_X',
        // 'DFX_FINANCE',
        'FIXED_FEE_SWAP',
        // 'UNIFI',
        'WSTETH',
        'DEFI_PLAZA',
        'FIXED_FEE_SWAP_V3',
        // 'SYNTHETIX_WRAPPER',
        'SYNAPSE',
        // 'CURVE_V2_YFI_2_ASSET',
        // 'CURVE_V2_ETH_PAL',
        // 'POOLTOGETHER',
        'ETH_BANCOR_V3',
        // 'ELASTICSWAP',
        // 'BALANCER_V2_WRAPPER',
        // 'FRAXSWAP',
        // 'RADIOSHACK',
        'KYBERSWAP_ELASTIC',
        // 'CURVE_V2_TWO_CRYPTO',
        'STABLE_PLAZA',
        'CURVE_3CRV',
        // 'KYBER_DMM_STATIC',
        'ANGLE',
        // 'ROCKET_POOL',
        // 'ETHEREUM_ELK',
        // 'ETHEREUM_PANCAKESWAP_V2',
        'SYNTHETIX_ATOMIC_SIP288',
        // 'PSM_GUSD',
      ].join(',')
    : chainId == 10
    ? [
        // comment out protocols would cause internal server error
        'OPTIMISM_SYNTHETIX',
        'OPTIMISM_SYNTHETIX_WRAPPER',
        'OPTIMISM_CURVE',
        // 'OPTIMISM_PMM6',
        'OPTIMISM_BALANCER_V2',
        'OPTIMISM_VELODROME',
        'OPTIMISM_KYBERSWAP_ELASTIC',
        // 'OPTIMISM_CLIPPER_COVES',
        // 'OPTIMISM_KYBER_DMM_STATIC',
        // 'OPTIMISM_AAVE_V3',
        // 'OPTIMISM_ELK',
      ].join(',')
    : chainId == 137
    ? [
        // comment out protocols would cause internal server error
        'POLYGON_QUICKSWAP',
        'POLYGON_CURVE',
        'POLYGON_SUSHISWAP',
        // 'POLYGON_AAVE_V2',
        'COMETH',
        'DFYN',
        'POLYGON_MSTABLE',
        'FIREBIRD_FINANCE',
        'ONESWAP',
        'POLYDEX_FINANCE',
        'POLYGON_WAULTSWAP',
        'POLYGON_BALANCER_V2',
        'POLYGON_KYBER_DMM',
        'POLYGON_DODO',
        'POLYGON_DODO_V2',
        'POLYGON_JETSWAP',
        'IRONSWAP',
        // 'POLYGON_UNIFI',
        // 'POLYGON_DFX_FINANCE',
        'POLYGON_APESWAP',
        'POLYGON_SAFE_SWAP',
        'POLYCAT_FINANCE',
        'POLYGON_CURVE_V2',
        'POLYGON_ELK',
        'POLYGON_SYNAPSE',
        // 'POLYGON_ALGEBRA_FINANCE',
        // 'POLYGON_PMM5',
        // 'POLYGON_PMM6',
        'POLYGON_GRAVITY',
        'POLYGON_PMMX',
        // 'POLYGON_NERVE',
        'POLYGON_DYSTOPIA',
        'POLYGON_RADIOSHACK',
        'POLYGON_PMM7',
        'POLYGON_MESHSWAP',
        'POLYGON_KYBERSWAP_ELASTIC',
        'POLYGON_WOOFI',
        'POLYGON_MAVERICK',
        // 'POLYGON_PMM4',
        // 'POLYGON_CLIPPER_COVES',
        'POLYGON_SWAAP',
        'MM_FINANCE',
        // 'POLYGON_KYBER_DMM_STATIC',
        // 'POLYGON_AAVE_V3',
        'POLYGON_QUICKSWAP_V3',
      ].join(',')
    : chainId == 42161
    ? [
        // comment out protocols would cause internal server error
        'ARBITRUM_BALANCER_V2',
        'ARBITRUM_DODO',
        'ARBITRUM_DODO_V2',
        'ARBITRUM_SUSHISWAP',
        'ARBITRUM_DXSWAP',
        'ARBITRUM_CURVE',
        'ARBITRUM_CURVE_V2',
        'ARBITRUM_GMX',
        'ARBITRUM_SYNAPSE',
        'ARBITRUM_PMM5',
        'ARBITRUM_SADDLE',
        'ARBITRUM_KYBERSWAP_ELASTIC',
        'ARBITRUM_KYBER_DMM_STATIC',
        // 'ARBITRUM_AAVE_V3',
        // 'ARBITRUM_ELK',
      ].join(',')
    : [
        // Avalanche
        // comment out protocols would cause internal server error
        // 'AVALANCHE_AAVE_V2',
        'AVALANCHE_CURVE',
        'AVALANCHE_CURVE_V2',
        'AVALANCHE_KYBER_DMM',
        'AVALANCHE_SUSHISWAP',
        'BAGUETTE',
        'CANARY',
        'ELK',
        'LYDIA',
        'OLIVESWAP',
        'PANGOLIN',
        'TRADERJOE',
        'YETTI',
        // 'AVALANCHE_THORUS',
        'AVALANCHE_HAKUSWAP',
        'AVALANCHE_PLATYPUS_FINANCE',
        'AVALANCHE_WOOFI',
        'AVALANCHE_AXIAL',
        //  'AVALANCHE_ELASTICSWAP',
        'AVALANCHE_GMX',
        //  'AVALANCHE_NERVE',
        //  'AVALANCHE_RADIOSHACK',
        'AVALANCHE_KYBERSWAP_ELASTIC',
        'AVALANCHE_SWAPSICLE',
        'AVALANCHE_KYBER_DMM_STATIC',
        // 'AVALANCHE_AAVE_V3',
      ].join(',');
const UNOSWAP_V3_PROTOCOLS =
  chainId == 1
    ? ['UNISWAP_V3'].join(',')
    : chainId == 10
    ? ['OPTIMISM_UNISWAP_V3'].join(',')
    : chainId == 137
    ? ['POLYGON_UNISWAP_V3'].join(',')
    : chainId == 42161
    ? ['ARBITRUM_UNISWAP_V3'].join(',')
    : ['']; // no uniswapV3 protocol
contract('OneInchV5 Swap', function([_, user]) {
  let id;

  before(async function() {
    // ============= 1inch API Health Check =============
    const healthCkeck = await callExternalApi(URL_1INCH + 'healthcheck');
    if (!healthCkeck.ok) {
      console.error(`=====> 1inch API not healthy now, skip the tests`);
      this.skip();
    }
    // ==================================================

    // Get 1inch router address
    const routerResponse = await callExternalApi(URL_1INCH + 'approve/spender');
    const routerAddress = (await routerResponse.json()).address;

    this.registry = await Registry.new();
    this.hOneInch = await HOneInch.new(routerAddress);
    await this.registry.register(
      this.hOneInch.address,
      utils.asciiToHex('OneInchV5')
    );
    this.feeRuleRegistry = await FeeRuleRegistry.new('0', _);
    this.proxy = await Proxy.new(
      this.registry.address,
      this.feeRuleRegistry.address
    );
  });

  beforeEach(async function() {
    id = await evmSnapshot();
  });

  afterEach(async function() {
    await evmRevert(id);
  });

  describe('Ether to Token', function() {
    const tokenAddress = DAI_TOKEN;

    let balanceUser;
    let balanceProxy;
    let tokenUser;

    before(async function() {
      this.token = await IToken.at(tokenAddress);
    });

    beforeEach(async function() {
      balanceUser = await tracker(user);
      balanceProxy = await tracker(this.proxy.address);
      tokenUser = await this.token.balanceOf.call(user);
    });

    describe('Swap', function() {
      it('normal', async function() {
        // Prepare data
        const value = ether('0.1');
        const to = this.hOneInch.address;
        const slippage = 3;
        const swapReq = queryString.stringifyUrl({
          url: URL_1INCH_SWAP,
          query: {
            fromTokenAddress: NATIVE_TOKEN_ADDRESS,
            toTokenAddress: tokenAddress,
            amount: value,
            slippage: slippage,
            disableEstimate: true,
            fromAddress: this.proxy.address,
            // If the route contains only Uniswap and its' forks, tx.data will invoke `unoswap`
            protocols: NON_UNOSWAP_PROTOCOLS,
          },
        });

        // Call 1inch API
        const swapResponse = await callExternalApi(swapReq);
        expect(swapResponse.ok, '1inch api response not ok').to.be.true;
        const swapData = await swapResponse.json();
        const quote = swapData.toTokenAmount;
        // Verify it's `swap` function call
        expect(swapData.tx.data.substring(0, 10)).to.be.eq(SELECTOR_1INCH_SWAP);
        // Prepare handler data
        const data = getCallData(HOneInch, 'swap', [
          NATIVE_TOKEN_ADDRESS,
          value,
          tokenAddress,
          swapData.tx.data,
        ]);

        // Execute
        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: value,
        });

        // Verify return value
        const tokenUserEnd = await this.token.balanceOf.call(user);
        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );
        expect(handlerReturn).to.be.bignumber.eq(tokenUserEnd.sub(tokenUser));

        // Verify token balance
        expect(tokenUserEnd).to.be.bignumber.gte(
          // sub 1 more percent to tolerate the slippage calculation difference with 1inch
          tokenUser.add(mulPercent(quote, 100 - slippage - 1))
        );
        expect(
          await this.token.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.zero;

        // Verify ether balance
        expect(await balanceProxy.get()).to.be.bignumber.zero;
        expect(await balanceUser.delta()).to.be.bignumber.eq(
          ether('0').sub(value)
        );

        profileGas(receipt);
      });

      it('msg.value greater than input ether amount', async function() {
        const value = ether('0.1');
        const to = this.hOneInch.address;
        const slippage = 3;

        const swapReq = queryString.stringifyUrl({
          url: URL_1INCH_SWAP,
          query: {
            fromTokenAddress: NATIVE_TOKEN_ADDRESS,
            toTokenAddress: tokenAddress,
            amount: value,
            slippage: slippage,
            disableEstimate: true,
            fromAddress: this.proxy.address,
            // If the route contains only Uniswap and its' forks, tx.data will invoke `unoswap`
            protocols: NON_UNOSWAP_PROTOCOLS,
          },
        });

        // Call 1inch API
        const swapResponse = await callExternalApi(swapReq);
        expect(swapResponse.ok, '1inch api response not ok').to.be.true;
        const swapData = await swapResponse.json();
        const quote = swapData.toTokenAmount;
        // Verify it's `swap` function call
        expect(swapData.tx.data.substring(0, 10)).to.be.eq(SELECTOR_1INCH_SWAP);
        // Prepare handler data
        const data = getCallData(HOneInch, 'swap', [
          NATIVE_TOKEN_ADDRESS,
          value,
          tokenAddress,
          swapData.tx.data,
        ]);

        // Execute
        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: value.add(ether('1')),
        });

        // Verify return value
        const tokenUserEnd = await this.token.balanceOf.call(user);
        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );
        expect(handlerReturn).to.be.bignumber.eq(tokenUserEnd.sub(tokenUser));

        // Verify token balance
        expect(tokenUserEnd).to.be.bignumber.gte(
          // sub 1 more percent to tolerate the slippage calculation difference with 1inch
          tokenUser.add(mulPercent(quote, 100 - slippage - 1))
        );
        expect(
          await this.token.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.zero;

        // Verify ether balance
        expect(await balanceProxy.get()).to.be.bignumber.zero;
        expect(await balanceUser.delta()).to.be.bignumber.eq(
          ether('0').sub(value)
        );

        profileGas(receipt);
      });
    });

    describe('Unoswap', function() {
      if (
        chainId == 10 ||
        chainId == 137 ||
        chainId == 42161 ||
        chainId == 43114
      ) {
        return;
      }

      // Prepare data
      it('normal', async function() {
        const value = ether('0.1');
        const to = this.hOneInch.address;
        const slippage = 3;
        const swapReq = queryString.stringifyUrl({
          url: URL_1INCH_SWAP,
          query: {
            fromTokenAddress: NATIVE_TOKEN_ADDRESS,
            toTokenAddress: tokenAddress,
            amount: value,
            slippage: slippage,
            disableEstimate: true,
            fromAddress: this.proxy.address,
            // If the route contains only Uniswap and its' forks, tx.data will invoke `unoswap`
            protocols: UNOSWAP_PROTOCOLS,
          },
        });

        // Call 1inch API
        const swapResponse = await callExternalApi(swapReq);
        expect(swapResponse.ok, '1inch api response not ok').to.be.true;
        const swapData = await swapResponse.json();
        const quote = swapData.toTokenAmount;
        // Verify it's `unoswap` function call
        expect(swapData.tx.data.substring(0, 10)).to.be.eq(
          SELECTOR_1INCH_UNOSWAP
        );

        // Prepare handler data
        const data = getCallData(HOneInch, 'swap', [
          NATIVE_TOKEN_ADDRESS,
          value,
          tokenAddress,
          swapData.tx.data,
        ]);

        // Execute
        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: value,
        });

        // Verify return value
        const tokenUserEnd = await this.token.balanceOf.call(user);
        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );
        expect(handlerReturn).to.be.bignumber.eq(tokenUserEnd.sub(tokenUser));

        // Verify token balance
        expect(tokenUserEnd).to.be.bignumber.gte(
          // sub 1 more percent to tolerate the slippage calculation difference with 1inch
          tokenUser.add(mulPercent(quote, 100 - slippage - 1))
        );
        expect(
          await this.token.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.zero;

        // Verify ether balance
        expect(await balanceProxy.get()).to.be.bignumber.zero;
        expect(await balanceUser.delta()).to.be.bignumber.eq(
          ether('0').sub(value)
        );

        profileGas(receipt);
      });

      it('should revert: wrong src token amount(ether)', async function() {
        const value = ether('0.1');
        const to = this.hOneInch.address;
        const slippage = 3;
        const swapReq = queryString.stringifyUrl({
          url: URL_1INCH_SWAP,
          query: {
            fromTokenAddress: NATIVE_TOKEN_ADDRESS,
            toTokenAddress: tokenAddress,
            amount: value,
            slippage: slippage,
            disableEstimate: true,
            fromAddress: this.proxy.address,
            // If the route contains only Uniswap and its' forks, tx.data will invoke `unoswap`
            protocols: UNOSWAP_PROTOCOLS,
          },
        });

        // Call 1inch API
        const swapResponse = await callExternalApi(swapReq);
        expect(swapResponse.ok, '1inch api response not ok').to.be.true;
        const swapData = await swapResponse.json();
        const quote = swapData.toTokenAmount;
        // Verify it's `unoswap` function call
        expect(swapData.tx.data.substring(0, 10)).to.be.eq(
          SELECTOR_1INCH_UNOSWAP
        );

        // Prepare handler data
        const data = getCallData(HOneInch, 'swap', [
          NATIVE_TOKEN_ADDRESS,
          value.sub(new BN(1000)),
          tokenAddress,
          swapData.tx.data,
        ]);

        // Execute
        await expectRevert.unspecified(
          this.proxy.execMock(to, data, { from: user, value: ether('0.1') })
        );
      });
    });

    describe('UnoswapV3', function() {
      if (chainId == 43114) {
        return;
      }

      // Prepare data
      it('normal', async function() {
        const value = ether('0.1');
        const to = this.hOneInch.address;
        const slippage = 3;
        const swapReq = queryString.stringifyUrl({
          url: URL_1INCH_SWAP,
          query: {
            fromTokenAddress: NATIVE_TOKEN_ADDRESS,
            toTokenAddress: tokenAddress,
            amount: value,
            slippage: slippage,
            disableEstimate: true,
            fromAddress: this.proxy.address,
            // If the route contains only UniswapV3, tx.data will invoke `unoswapV3`
            protocols: UNOSWAP_V3_PROTOCOLS,
          },
        });

        // Call 1inch API
        const swapResponse = await callExternalApi(swapReq);
        expect(swapResponse.ok, '1inch api response not ok').to.be.true;
        const swapData = await swapResponse.json();
        const quote = swapData.toTokenAmount;
        // Verify it's `unoswap` function call
        if (chainId == 10) {
          // Function sig will be SELECTOR_1INCH_UNOSWAP_V3_SWAP or SELECTOR_1INCH_SWAP on Optimism
          expect(
            swapData.tx.data.substring(0, 10) ==
              SELECTOR_1INCH_UNOSWAP_V3_SWAP ||
              swapData.tx.data.substring(0, 10) == SELECTOR_1INCH_SWAP
          ).to.be.true;
        } else {
          expect(swapData.tx.data.substring(0, 10)).to.be.eq(
            SELECTOR_1INCH_UNOSWAP_V3_SWAP
          );
        }

        // Prepare handler data
        const data = getCallData(HOneInch, 'swap', [
          NATIVE_TOKEN_ADDRESS,
          value,
          tokenAddress,
          swapData.tx.data,
        ]);

        // Execute
        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: value,
        });

        // Verify return value
        const tokenUserEnd = await this.token.balanceOf.call(user);
        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );
        expect(handlerReturn).to.be.bignumber.eq(tokenUserEnd.sub(tokenUser));

        // Verify token balance
        expect(tokenUserEnd).to.be.bignumber.gte(
          // sub 1 more percent to tolerate the slippage calculation difference with 1inch
          tokenUser.add(mulPercent(quote, 100 - slippage - 1))
        );
        expect(
          await this.token.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.zero;

        // Verify ether balance
        expect(await balanceProxy.get()).to.be.bignumber.zero;
        expect(await balanceUser.delta()).to.be.bignumber.eq(
          ether('0').sub(value)
        );

        profileGas(receipt);
      });

      it('should revert: wrong src token amount(ether)', async function() {
        const value = ether('0.1');
        const to = this.hOneInch.address;
        const slippage = 3;
        const swapReq = queryString.stringifyUrl({
          url: URL_1INCH_SWAP,
          query: {
            fromTokenAddress: NATIVE_TOKEN_ADDRESS,
            toTokenAddress: tokenAddress,
            amount: value,
            slippage: slippage,
            disableEstimate: true,
            fromAddress: this.proxy.address,
            // If the route contains only Uniswap and its' forks, tx.data will invoke `unoswap`
            protocols: UNOSWAP_V3_PROTOCOLS,
          },
        });

        // Call 1inch API
        const swapResponse = await callExternalApi(swapReq);
        expect(swapResponse.ok, '1inch api response not ok').to.be.true;
        const swapData = await swapResponse.json();
        // Verify it's `unoswapV3` function call
        if (chainId == 10) {
          // Function sig will be SELECTOR_1INCH_UNOSWAP_V3_SWAP or SELECTOR_1INCH_SWAP on Optimism
          expect(
            swapData.tx.data.substring(0, 10) ==
              SELECTOR_1INCH_UNOSWAP_V3_SWAP ||
              swapData.tx.data.substring(0, 10) == SELECTOR_1INCH_SWAP
          ).to.be.true;
        } else {
          expect(swapData.tx.data.substring(0, 10)).to.be.eq(
            SELECTOR_1INCH_UNOSWAP_V3_SWAP
          );
        }

        // Prepare handler data
        const data = getCallData(HOneInch, 'swap', [
          NATIVE_TOKEN_ADDRESS,
          value.sub(new BN(1000)),
          tokenAddress,
          swapData.tx.data,
        ]);

        // Execute
        await expectRevert.unspecified(
          this.proxy.execMock(to, data, { from: user, value: ether('0.1') })
        );
      });
    });
  });

  describe('Token to Ether', function() {
    const tokenAddress = DAI_TOKEN;

    let balanceUser;
    let balanceProxy;
    let tokenUser;
    let providerAddress;

    before(async function() {
      providerAddress = await getTokenProvider(tokenAddress);

      this.token = await IToken.at(tokenAddress);
    });

    beforeEach(async function() {
      balanceUser = await tracker(user);
      balanceProxy = await tracker(this.proxy.address);
      tokenUser = await this.token.balanceOf.call(user);
    });

    describe('Swap', function() {
      it('normal', async function() {
        // Prepare data
        const value = ether('100');
        const to = this.hOneInch.address;
        const slippage = 3;
        const swapReq = queryString.stringifyUrl({
          url: URL_1INCH_SWAP,
          query: {
            fromTokenAddress: tokenAddress,
            toTokenAddress: NATIVE_TOKEN_ADDRESS,
            amount: value,
            slippage: slippage,
            disableEstimate: true,
            fromAddress: this.proxy.address,
            protocols: NON_UNOSWAP_PROTOCOLS,
          },
        });

        // Transfer from token to Proxy first
        await this.token.transfer(this.proxy.address, value, {
          from: providerAddress,
        });
        await this.proxy.updateTokenMock(this.token.address);

        // Call 1inch API
        const swapResponse = await callExternalApi(swapReq);
        expect(swapResponse.ok, '1inch api response not ok').to.be.true;
        const swapData = await swapResponse.json();
        const quote = swapData.toTokenAmount;
        // Verify it's `swap` function call
        expect(swapData.tx.data.substring(0, 10)).to.be.eq(SELECTOR_1INCH_SWAP);
        // Prepare handler data
        const data = getCallData(HOneInch, 'swap', [
          tokenAddress,
          value,
          NATIVE_TOKEN_ADDRESS,
          swapData.tx.data,
        ]);

        // Execute
        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: ether('0.1'),
        });

        // Verify return value
        const balanceUserDelta = await balanceUser.delta();
        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );
        expect(handlerReturn).to.be.bignumber.eq(balanceUserDelta);

        // Verify token balance
        expect(await this.token.balanceOf.call(user)).to.be.bignumber.eq(
          tokenUser
        );
        expect(
          await this.token.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.zero;

        // Verify ether balance
        expect(await balanceProxy.get()).to.be.bignumber.zero;
        expect(balanceUserDelta).to.be.bignumber.gte(
          ether('0')
            // sub 1 more percent to tolerate the slippage calculation difference with 1inch
            .add(mulPercent(quote, 100 - slippage - 1))
        );

        profileGas(receipt);
      });
    });

    describe('Unoswap', function() {
      if (
        chainId == 10 ||
        chainId == 137 ||
        chainId == 42161 ||
        chainId == 43114
      ) {
        return;
      }

      it('normal', async function() {
        // Prepare data
        const value = ether('100');
        const to = this.hOneInch.address;
        const slippage = 3;
        const swapReq = queryString.stringifyUrl({
          url: URL_1INCH_SWAP,
          query: {
            fromTokenAddress: tokenAddress,
            toTokenAddress: NATIVE_TOKEN_ADDRESS,
            amount: value,
            slippage: slippage,
            disableEstimate: true,
            fromAddress: this.proxy.address,
            // If the route contains only Uniswap and its' forks, tx.data will invoke `unoswap`
            protocols: UNOSWAP_PROTOCOLS,
          },
        });

        // Transfer from token to Proxy first
        await this.token.transfer(this.proxy.address, value, {
          from: providerAddress,
        });
        await this.proxy.updateTokenMock(this.token.address);

        // Call 1inch API
        const swapResponse = await callExternalApi(swapReq);
        expect(swapResponse.ok, '1inch api response not ok').to.be.true;
        const swapData = await swapResponse.json();
        const quote = swapData.toTokenAmount;
        // Verify it's `unoswap` function call
        expect(swapData.tx.data.substring(0, 10)).to.be.eq(
          SELECTOR_1INCH_UNOSWAP
        );

        // Prepare handler data
        const data = getCallData(HOneInch, 'swap', [
          tokenAddress,
          value,
          NATIVE_TOKEN_ADDRESS,
          swapData.tx.data,
        ]);

        // Execute
        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: ether('0.1'),
        });

        // Verify return value
        const balanceUserDelta = await balanceUser.delta();
        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );
        expect(handlerReturn).to.be.bignumber.eq(balanceUserDelta);

        // Verify token balance
        expect(await this.token.balanceOf.call(user)).to.be.bignumber.eq(
          tokenUser
        );
        expect(
          await this.token.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.zero;

        // Verify ether balance
        expect(await balanceProxy.get()).to.be.bignumber.zero;
        expect(balanceUserDelta).to.be.bignumber.gte(
          ether('0')
            // sub 1 more percent to tolerate the slippage calculation difference with 1inch
            .add(mulPercent(quote, 100 - slippage - 1))
        );

        profileGas(receipt);
      });
    });

    describe('UnoswapV3', function() {
      if (chainId == 43114) {
        return;
      }

      it('normal', async function() {
        // Prepare data
        const value = ether('100');
        const to = this.hOneInch.address;
        const slippage = 3;
        const swapReq = queryString.stringifyUrl({
          url: URL_1INCH_SWAP,
          query: {
            fromTokenAddress: tokenAddress,
            toTokenAddress: NATIVE_TOKEN_ADDRESS,
            amount: value,
            slippage: slippage,
            disableEstimate: true,
            fromAddress: this.proxy.address,
            // If the route contains only UniswapV3, tx.data will invoke `unoswapV3`
            protocols: UNOSWAP_V3_PROTOCOLS,
          },
        });
        // Transfer from token to Proxy first
        await this.token.transfer(this.proxy.address, value, {
          from: providerAddress,
        });
        await this.proxy.updateTokenMock(this.token.address);

        // Call 1inch API
        const swapResponse = await callExternalApi(swapReq);
        expect(swapResponse.ok, '1inch api response not ok').to.be.true;
        const swapData = await swapResponse.json();
        const quote = swapData.toTokenAmount;
        // Verify it's `unoswapV3` function call
        if (chainId == 10) {
          // Function sig will be SELECTOR_1INCH_UNOSWAP_V3_SWAP or SELECTOR_1INCH_SWAP on Optimism
          expect(
            swapData.tx.data.substring(0, 10) ==
              SELECTOR_1INCH_UNOSWAP_V3_SWAP ||
              swapData.tx.data.substring(0, 10) == SELECTOR_1INCH_SWAP
          ).to.be.true;
        } else {
          expect(swapData.tx.data.substring(0, 10)).to.be.eq(
            SELECTOR_1INCH_UNOSWAP_V3_SWAP
          );
        }

        // Prepare handler data
        const data = getCallData(HOneInch, 'swap', [
          tokenAddress,
          value,
          NATIVE_TOKEN_ADDRESS,
          swapData.tx.data,
        ]);

        // Execute
        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: ether('0.1'),
        });

        // Verify return value
        const balanceUserDelta = await balanceUser.delta();
        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );
        expect(handlerReturn).to.be.bignumber.eq(balanceUserDelta);

        // Verify token balance
        expect(await this.token.balanceOf.call(user)).to.be.bignumber.eq(
          tokenUser
        );
        expect(
          await this.token.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.zero;

        // Verify ether balance
        expect(await balanceProxy.get()).to.be.bignumber.zero;
        expect(balanceUserDelta).to.be.bignumber.gte(
          ether('0')
            // sub 1 more percent to tolerate the slippage calculation difference with 1inch
            .add(mulPercent(quote, 100 - slippage - 1))
        );

        profileGas(receipt);
      });
    });
  });

  describe('Token to Token', function() {
    const token0Address = DAI_TOKEN;
    const token1Address = USDC_TOKEN;

    let balanceUser;
    let balanceProxy;
    let token0User;
    let token1User;
    let wethUser;
    let wethProxy;
    let providerAddress;

    before(async function() {
      providerAddress = await getTokenProvider(token0Address);

      this.token0 = await IToken.at(token0Address);
      this.token1 = await IToken.at(token1Address);
      this.weth = await IToken.at(WETH_TOKEN);
    });

    beforeEach(async function() {
      balanceUser = await tracker(user);
      balanceProxy = await tracker(this.proxy.address);
      token0User = await this.token0.balanceOf.call(user);
      token1User = await this.token1.balanceOf.call(user);
      wethUser = await this.weth.balanceOf.call(user);
      wethProxy = await this.weth.balanceOf.call(this.proxy.address);
    });

    describe('Swap', function() {
      it('normal', async function() {
        // Prepare data
        const value = ether('100');
        const to = this.hOneInch.address;
        const slippage = 3;
        const swapReq = queryString.stringifyUrl({
          url: URL_1INCH_SWAP,
          query: {
            fromTokenAddress: token0Address,
            toTokenAddress: token1Address,
            amount: value,
            slippage: slippage,
            disableEstimate: true,
            fromAddress: this.proxy.address,
            protocols: NON_UNOSWAP_PROTOCOLS,
          },
        });

        // Transfer from token to Proxy first
        await this.token0.transfer(this.proxy.address, value, {
          from: providerAddress,
        });
        await this.proxy.updateTokenMock(this.token0.address);

        // Call 1inch API
        const swapResponse = await callExternalApi(swapReq);
        expect(swapResponse.ok, '1inch api response not ok').to.be.true;
        const swapData = await swapResponse.json();
        const quote = swapData.toTokenAmount;
        // Verify it's `swap` function call
        expect(swapData.tx.data.substring(0, 10)).to.be.eq(SELECTOR_1INCH_SWAP);
        // Prepare handler data
        const data = getCallData(HOneInch, 'swap', [
          token0Address,
          value,
          token1Address,
          swapData.tx.data,
        ]);

        // Execute
        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: ether('0.1'),
        });

        // Verify return value
        const token1UserEnd = await this.token1.balanceOf.call(user);
        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );
        expect(handlerReturn).to.be.bignumber.eq(token1UserEnd.sub(token1User));

        // Verify token0 balance
        expect(await this.token0.balanceOf.call(user)).to.be.bignumber.eq(
          token0User
        );
        expect(
          await this.token0.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.zero;

        // Verify token1 balance
        expect(await this.token1.balanceOf.call(user)).to.be.bignumber.gte(
          // sub 1 more percent to tolerate the slippage calculation difference with 1inch
          token1User.add(mulPercent(quote, 100 - slippage - 1))
        );
        expect(
          await this.token1.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.zero;

        // Verify ether balance
        expect(await balanceProxy.get()).to.be.bignumber.zero;
        expect(await balanceUser.delta()).to.be.bignumber.eq(ether('0'));

        profileGas(receipt);
      });
    });

    describe('Unoswap', function() {
      if (
        chainId == 10 ||
        chainId == 137 ||
        chainId == 42161 ||
        chainId == 43114
      ) {
        return;
      }

      it('normal', async function() {
        // Prepare data
        const value = ether('100');
        const to = this.hOneInch.address;
        const slippage = 3;
        const swapReq = queryString.stringifyUrl({
          url: URL_1INCH_SWAP,
          query: {
            fromTokenAddress: token0Address,
            toTokenAddress: token1Address,
            amount: value,
            slippage: slippage,
            disableEstimate: true,
            fromAddress: this.proxy.address,
            // If the route contains only Uniswap and its' forks, tx.data will invoke `unoswap`
            protocols: UNOSWAP_PROTOCOLS,
          },
        });

        // Transfer from token to Proxy first
        await this.token0.transfer(this.proxy.address, value, {
          from: providerAddress,
        });
        await this.proxy.updateTokenMock(this.token0.address);

        // Call 1inch API
        const swapResponse = await callExternalApi(swapReq);
        expect(swapResponse.ok, '1inch api response not ok').to.be.true;
        const swapData = await swapResponse.json();
        const quote = swapData.toTokenAmount;
        // Verify it's `unoswap` function call
        expect(swapData.tx.data.substring(0, 10)).to.be.eq(
          SELECTOR_1INCH_UNOSWAP
        );

        // Prepare handler data
        const data = getCallData(HOneInch, 'swap', [
          token0Address,
          value,
          token1Address,
          swapData.tx.data,
        ]);

        // Execute
        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: ether('0.1'),
        });

        // Verify return value
        const token1UserEnd = await this.token1.balanceOf.call(user);
        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );
        expect(handlerReturn).to.be.bignumber.eq(token1UserEnd.sub(token1User));

        // Verify token0 balance
        expect(await this.token0.balanceOf.call(user)).to.be.bignumber.eq(
          token0User
        );
        expect(
          await this.token0.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.zero;

        // Verify token1 balance
        expect(await this.token1.balanceOf.call(user)).to.be.bignumber.gte(
          // sub 1 more percent to tolerate the slippage calculation difference with 1inch
          token1User.add(mulPercent(quote, 100 - slippage - 1))
        );
        expect(
          await this.token1.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.zero;

        // Verify ether balance
        expect(await balanceProxy.get()).to.be.bignumber.zero;
        expect(await balanceUser.delta()).to.be.bignumber.eq(ether('0'));

        profileGas(receipt);
      });

      it('to weth', async function() {
        // Prepare data
        const value = ether('100');
        const to = this.hOneInch.address;
        const slippage = 3;
        const swapReq = queryString.stringifyUrl({
          url: URL_1INCH_SWAP,
          query: {
            fromTokenAddress: token0Address,
            toTokenAddress: WETH_TOKEN,
            amount: value,
            slippage: slippage,
            disableEstimate: true,
            fromAddress: this.proxy.address,
            // If the route contains only Uniswap and its' forks, tx.data will invoke `unoswap`
            protocols: UNOSWAP_PROTOCOLS,
          },
        });

        // Transfer from token to Proxy first
        await this.token0.transfer(this.proxy.address, value, {
          from: providerAddress,
        });
        await this.proxy.updateTokenMock(this.token0.address);

        // Call 1inch API
        const swapResponse = await callExternalApi(swapReq);
        expect(swapResponse.ok, '1inch api response not ok').to.be.true;
        const swapData = await swapResponse.json();
        const quote = swapData.toTokenAmount;
        // Verify it's `unoswap` function call
        expect(swapData.tx.data.substring(0, 10)).to.be.eq(
          SELECTOR_1INCH_UNOSWAP
        );

        // Prepare handler data
        const data = getCallData(HOneInch, 'swap', [
          token0Address,
          value,
          WETH_TOKEN,
          swapData.tx.data,
        ]);

        // Execute
        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: ether('0.1'),
        });

        // Verify return value
        const wethUserEnd = await this.weth.balanceOf.call(user);
        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );
        expect(handlerReturn).to.be.bignumber.eq(wethUserEnd.sub(wethUser));

        // Verify token0 balance
        expect(await this.token0.balanceOf.call(user)).to.be.bignumber.eq(
          token0User
        );
        expect(
          await this.token0.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.zero;

        // Verify weth balance
        expect(await this.weth.balanceOf.call(user)).to.be.bignumber.gte(
          // sub 1 more percent to tolerate the slippage calculation difference with 1inch
          wethUser.add(mulPercent(quote, 100 - slippage - 1))
        );
        expect(
          await this.weth.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.zero;

        // Verify ether balance
        expect(await balanceProxy.get()).to.be.bignumber.zero;
        expect(await balanceUser.delta()).to.be.bignumber.eq(ether('0'));

        profileGas(receipt);
      });

      it('append extra data to API data at the end', async function() {
        // Prepare data
        const appendData = 'ff0000ff';
        const value = ether('100');
        const to = this.hOneInch.address;
        const slippage = 3;
        const swapReq = queryString.stringifyUrl({
          url: URL_1INCH_SWAP,
          query: {
            fromTokenAddress: token0Address,
            toTokenAddress: WETH_TOKEN,
            amount: value,
            slippage: slippage,
            disableEstimate: true,
            fromAddress: this.proxy.address,
            // If the route contains only Uniswap and its' forks, tx.data will invoke `unoswap`
            protocols: UNOSWAP_PROTOCOLS,
          },
        });

        // Transfer from token to Proxy first
        await this.token0.transfer(this.proxy.address, value, {
          from: providerAddress,
        });
        await this.proxy.updateTokenMock(this.token0.address);

        // Call 1inch API
        const swapResponse = await callExternalApi(swapReq);
        expect(swapResponse.ok, '1inch api response not ok').to.be.true;
        const swapData = await swapResponse.json();
        const quote = swapData.toTokenAmount;
        // Verify it's `unoswap` function call
        expect(swapData.tx.data.substring(0, 10)).to.be.eq(
          SELECTOR_1INCH_UNOSWAP
        );

        // Prepare handler data
        var data = getCallData(HOneInch, 'swap', [
          token0Address,
          value,
          WETH_TOKEN,
          swapData.tx.data,
        ]);
        data = data + appendData;

        // Execute
        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: ether('0.1'),
        });

        // Verify return value
        const wethUserEnd = await this.weth.balanceOf.call(user);
        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );
        expect(handlerReturn).to.be.bignumber.eq(wethUserEnd.sub(wethUser));

        // Verify token0 balance
        expect(await this.token0.balanceOf.call(user)).to.be.bignumber.eq(
          token0User
        );
        expect(
          await this.token0.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.zero;

        // Verify weth balance
        expect(await this.weth.balanceOf.call(user)).to.be.bignumber.gte(
          // sub 1 more percent to tolerate the slippage calculation difference with 1inch
          wethUser.add(mulPercent(quote, 100 - slippage - 1))
        );
        expect(
          await this.weth.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.zero;

        // Verify ether balance
        expect(await balanceProxy.get()).to.be.bignumber.zero;
        expect(await balanceUser.delta()).to.be.bignumber.eq(ether('0'));

        profileGas(receipt);
      });

      it('should revert: wrong dst token(ether)', async function() {
        // Prepare data
        const value = ether('100');
        const to = this.hOneInch.address;
        const slippage = 3;
        const swapReq = queryString.stringifyUrl({
          url: URL_1INCH_SWAP,
          query: {
            fromTokenAddress: token0Address,
            toTokenAddress: token1Address,
            amount: value,
            slippage: slippage,
            disableEstimate: true,
            fromAddress: this.proxy.address,
            // If the route contains only Uniswap and its' forks, tx.data will invoke `unoswap`
            protocols: UNOSWAP_PROTOCOLS,
          },
        });

        // Transfer from token to Proxy first
        await this.token0.transfer(this.proxy.address, value, {
          from: providerAddress,
        });
        await this.proxy.updateTokenMock(this.token0.address);

        // Call 1inch API
        const swapResponse = await callExternalApi(swapReq);
        expect(swapResponse.ok, '1inch api response not ok').to.be.true;
        const swapData = await swapResponse.json();
        const quote = swapData.toTokenAmount;
        // Verify it's `unoswap` function call
        expect(swapData.tx.data.substring(0, 10)).to.be.eq(
          SELECTOR_1INCH_UNOSWAP
        );

        // Prepare handler data
        const data = getCallData(HOneInch, 'swap', [
          token0Address,
          value,
          NATIVE_TOKEN_ADDRESS,
          swapData.tx.data,
        ]);

        await expectRevert(
          this.proxy.execMock(to, data, { from: user, value: ether('0.1') }),
          '0_HOneInchV5_swap: Invalid output token amount'
        );
      });

      it('should revert: wrong dst token(erc20)', async function() {
        // Prepare data
        const value = ether('100');
        const to = this.hOneInch.address;
        const slippage = 3;
        const swapReq = queryString.stringifyUrl({
          url: URL_1INCH_SWAP,
          query: {
            fromTokenAddress: token0Address,
            toTokenAddress: token1Address,
            amount: value,
            slippage: slippage,
            disableEstimate: true,
            fromAddress: this.proxy.address,
            // If the route contains only Uniswap and its' forks, tx.data will invoke `unoswap`
            protocols: UNOSWAP_PROTOCOLS,
          },
        });

        // Transfer from token to Proxy first
        await this.token0.transfer(this.proxy.address, value, {
          from: providerAddress,
        });
        await this.proxy.updateTokenMock(this.token0.address);

        // Call 1inch API
        const swapResponse = await callExternalApi(swapReq);
        expect(swapResponse.ok, '1inch api response not ok').to.be.true;
        const swapData = await swapResponse.json();
        const quote = swapData.toTokenAmount;
        // Verify it's `unoswap` function call
        expect(swapData.tx.data.substring(0, 10)).to.be.eq(
          SELECTOR_1INCH_UNOSWAP
        );

        // Prepare handler data
        const data = getCallData(HOneInch, 'swap', [
          token0Address,
          value,
          WETH_TOKEN,
          swapData.tx.data,
        ]);

        await expectRevert(
          this.proxy.execMock(to, data, { from: user, value: ether('0.1') }),
          '0_HOneInchV5_swap: Invalid output token amount'
        );
      });

      it('should revert: wrong src token(ether)', async function() {
        // Prepare data
        const value = ether('100');
        const to = this.hOneInch.address;
        const slippage = 3;
        const swapReq = queryString.stringifyUrl({
          url: URL_1INCH_SWAP,
          query: {
            fromTokenAddress: token0Address,
            toTokenAddress: token1Address,
            amount: value,
            slippage: slippage,
            disableEstimate: true,
            fromAddress: this.proxy.address,
            // If the route contains only Uniswap and its' forks, tx.data will invoke `unoswap`
            protocols: UNOSWAP_PROTOCOLS,
          },
        });

        // Transfer from token to Proxy first
        await this.token0.transfer(this.proxy.address, value, {
          from: providerAddress,
        });
        await this.proxy.updateTokenMock(this.token0.address);

        // Call 1inch API
        const swapResponse = await callExternalApi(swapReq);
        expect(swapResponse.ok, '1inch api response not ok').to.be.true;
        const swapData = await swapResponse.json();
        const quote = swapData.toTokenAmount;
        // Verify it's `unoswap` function call
        expect(swapData.tx.data.substring(0, 10)).to.be.eq(
          SELECTOR_1INCH_UNOSWAP
        );

        // Prepare handler data
        const data = getCallData(HOneInch, 'swap', [
          NATIVE_TOKEN_ADDRESS,
          value,
          token1Address,
          swapData.tx.data,
        ]);

        await expectRevert.unspecified(
          this.proxy.execMock(to, data, { from: user, value: ether('0.1') })
        );
      });

      it('should revert: wrong src token(erc20)', async function() {
        // Prepare data
        const value = ether('100');
        const to = this.hOneInch.address;
        const slippage = 3;
        const swapReq = queryString.stringifyUrl({
          url: URL_1INCH_SWAP,
          query: {
            fromTokenAddress: token0Address,
            toTokenAddress: token1Address,
            amount: value,
            slippage: slippage,
            disableEstimate: true,
            fromAddress: this.proxy.address,
            // If the route contains only Uniswap and its' forks, tx.data will invoke `unoswap`
            protocols: UNOSWAP_PROTOCOLS,
          },
        });

        // Transfer from token to Proxy first
        await this.token0.transfer(this.proxy.address, value, {
          from: providerAddress,
        });
        await this.proxy.updateTokenMock(this.token0.address);

        // Call 1inch API
        const swapResponse = await callExternalApi(swapReq);
        expect(swapResponse.ok, '1inch api response not ok').to.be.true;
        const swapData = await swapResponse.json();
        const quote = swapData.toTokenAmount;
        // Verify it's `unoswap` function call
        expect(swapData.tx.data.substring(0, 10)).to.be.eq(
          SELECTOR_1INCH_UNOSWAP
        );

        // Prepare handler data
        const data = getCallData(HOneInch, 'swap', [
          WETH_TOKEN,
          value,
          token1Address,
          swapData.tx.data,
        ]);

        await expectRevert(
          this.proxy.execMock(to, data, { from: user, value: ether('0.1') }),
          '0_HOneInchV5__oneinchswapCall: Dai/insufficient-allowance'
        );
      });

      it('should revert: wrong src token amount(erc20)', async function() {
        // Prepare data
        const value = ether('100');
        const to = this.hOneInch.address;
        const slippage = 3;
        const swapReq = queryString.stringifyUrl({
          url: URL_1INCH_SWAP,
          query: {
            fromTokenAddress: token0Address,
            toTokenAddress: token1Address,
            amount: value,
            slippage: slippage,
            disableEstimate: true,
            fromAddress: this.proxy.address,
            // If the route contains only Uniswap and its' forks, tx.data will invoke `unoswap`
            protocols: UNOSWAP_PROTOCOLS,
          },
        });

        // Transfer from token to Proxy first
        await this.token0.transfer(this.proxy.address, value, {
          from: providerAddress,
        });
        await this.proxy.updateTokenMock(this.token0.address);

        // Call 1inch API
        const swapResponse = await callExternalApi(swapReq);
        expect(swapResponse.ok, '1inch api response not ok').to.be.true;
        const swapData = await swapResponse.json();
        const quote = swapData.toTokenAmount;
        // Verify it's `unoswap` function call
        expect(swapData.tx.data.substring(0, 10)).to.be.eq(
          SELECTOR_1INCH_UNOSWAP
        );

        // Prepare handler data
        const data = getCallData(HOneInch, 'swap', [
          token0Address,
          value.sub(new BN(1000)),
          token1Address,
          swapData.tx.data,
        ]);

        await expectRevert(
          this.proxy.execMock(to, data, { from: user, value: ether('0.1') }),
          '0_HOneInchV5__oneinchswapCall: Dai/insufficient-allowance'
        );
      });
    });

    describe('UnoswapV3', function() {
      if (chainId == 43114) {
        return;
      }

      it('normal', async function() {
        // Prepare data
        const value = ether('100');
        const to = this.hOneInch.address;
        const slippage = 3;
        const swapReq = queryString.stringifyUrl({
          url: URL_1INCH_SWAP,
          query: {
            fromTokenAddress: token0Address,
            toTokenAddress: token1Address,
            amount: value,
            slippage: slippage,
            disableEstimate: true,
            fromAddress: this.proxy.address,
            // If the route contains only UniswapV3, tx.data will invoke `unoswapV3`
            protocols: UNOSWAP_V3_PROTOCOLS,
          },
        });

        // Transfer from token to Proxy first
        await this.token0.transfer(this.proxy.address, value, {
          from: providerAddress,
        });
        await this.proxy.updateTokenMock(this.token0.address);

        // Call 1inch API
        const swapResponse = await callExternalApi(swapReq);
        expect(swapResponse.ok, '1inch api response not ok').to.be.true;
        const swapData = await swapResponse.json();
        const quote = swapData.toTokenAmount;
        // Verify it's `unoswapV3` function call
        if (chainId == 10) {
          // Function sig will be SELECTOR_1INCH_UNOSWAP_V3_SWAP or SELECTOR_1INCH_SWAP on Optimism
          expect(
            swapData.tx.data.substring(0, 10) ==
              SELECTOR_1INCH_UNOSWAP_V3_SWAP ||
              swapData.tx.data.substring(0, 10) == SELECTOR_1INCH_SWAP
          ).to.be.true;
        } else {
          expect(swapData.tx.data.substring(0, 10)).to.be.eq(
            SELECTOR_1INCH_UNOSWAP_V3_SWAP
          );
        }

        // Prepare handler data
        const data = getCallData(HOneInch, 'swap', [
          token0Address,
          value,
          token1Address,
          swapData.tx.data,
        ]);

        // Execute
        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: ether('0.1'),
        });

        // Verify return value
        const token1UserEnd = await this.token1.balanceOf.call(user);
        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );
        expect(handlerReturn).to.be.bignumber.eq(token1UserEnd.sub(token1User));

        // Verify token0 balance
        expect(await this.token0.balanceOf.call(user)).to.be.bignumber.eq(
          token0User
        );
        expect(
          await this.token0.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.zero;

        // Verify token1 balance
        expect(await this.token1.balanceOf.call(user)).to.be.bignumber.gte(
          // sub 1 more percent to tolerate the slippage calculation difference with 1inch
          token1User.add(mulPercent(quote, 100 - slippage - 1))
        );
        expect(
          await this.token1.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.zero;

        // Verify ether balance
        expect(await balanceProxy.get()).to.be.bignumber.zero;
        expect(await balanceUser.delta()).to.be.bignumber.eq(ether('0'));

        profileGas(receipt);
      });

      it('to weth', async function() {
        // Prepare data
        const value = ether('100');
        const to = this.hOneInch.address;
        const slippage = 3;
        const swapReq = queryString.stringifyUrl({
          url: URL_1INCH_SWAP,
          query: {
            fromTokenAddress: token0Address,
            toTokenAddress: WETH_TOKEN,
            amount: value,
            slippage: slippage,
            disableEstimate: true,
            fromAddress: this.proxy.address,
            // If the route contains only Uniswap and its' forks, tx.data will invoke `unoswapV3`
            protocols: UNOSWAP_V3_PROTOCOLS,
          },
        });

        // Transfer from token to Proxy first
        await this.token0.transfer(this.proxy.address, value, {
          from: providerAddress,
        });
        await this.proxy.updateTokenMock(this.token0.address);

        // Call 1inch API
        const swapResponse = await callExternalApi(swapReq);
        expect(swapResponse.ok, '1inch api response not ok').to.be.true;
        const swapData = await swapResponse.json();
        const quote = swapData.toTokenAmount;
        // Verify it's `unoswapV3` function call
        if (chainId == 10) {
          // Function sig will be SELECTOR_1INCH_UNOSWAP_V3_SWAP or SELECTOR_1INCH_SWAP on Optimism
          expect(
            swapData.tx.data.substring(0, 10) ==
              SELECTOR_1INCH_UNOSWAP_V3_SWAP ||
              swapData.tx.data.substring(0, 10) == SELECTOR_1INCH_SWAP
          ).to.be.true;
        } else {
          expect(swapData.tx.data.substring(0, 10)).to.be.eq(
            SELECTOR_1INCH_UNOSWAP_V3_SWAP
          );
        }

        // Prepare handler data
        const data = getCallData(HOneInch, 'swap', [
          token0Address,
          value,
          WETH_TOKEN,
          swapData.tx.data,
        ]);

        // Execute
        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: ether('0.1'),
        });

        // Verify return value
        const wethUserEnd = await this.weth.balanceOf.call(user);
        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );
        expect(handlerReturn).to.be.bignumber.eq(wethUserEnd.sub(wethUser));

        // Verify token0 balance
        expect(await this.token0.balanceOf.call(user)).to.be.bignumber.eq(
          token0User
        );
        expect(
          await this.token0.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.zero;

        // Verify weth balance
        expect(await this.weth.balanceOf.call(user)).to.be.bignumber.gte(
          // sub 1 more percent to tolerate the slippage calculation difference with 1inch
          wethUser.add(mulPercent(quote, 100 - slippage - 1))
        );
        expect(
          await this.weth.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.zero;

        // Verify ether balance
        expect(await balanceProxy.get()).to.be.bignumber.zero;
        expect(await balanceUser.delta()).to.be.bignumber.eq(ether('0'));

        profileGas(receipt);
      });

      it('append extra data to API data at the end', async function() {
        // Prepare data
        const appendData = 'ff0000ff';
        const value = ether('100');
        const to = this.hOneInch.address;
        const slippage = 3;
        const swapReq = queryString.stringifyUrl({
          url: URL_1INCH_SWAP,
          query: {
            fromTokenAddress: token0Address,
            toTokenAddress: WETH_TOKEN,
            amount: value,
            slippage: slippage,
            disableEstimate: true,
            fromAddress: this.proxy.address,
            // If the route contains only Uniswap and its' forks, tx.data will invoke `unoswapV3`
            protocols: UNOSWAP_V3_PROTOCOLS,
          },
        });

        // Transfer from token to Proxy first
        await this.token0.transfer(this.proxy.address, value, {
          from: providerAddress,
        });
        await this.proxy.updateTokenMock(this.token0.address);

        // Call 1inch API
        const swapResponse = await callExternalApi(swapReq);
        expect(swapResponse.ok, '1inch api response not ok').to.be.true;
        const swapData = await swapResponse.json();
        const quote = swapData.toTokenAmount;
        // Verify it's `unoswapV3` function call
        if (chainId == 10) {
          // Function sig will be SELECTOR_1INCH_UNOSWAP_V3_SWAP or SELECTOR_1INCH_SWAP on Optimism
          expect(
            swapData.tx.data.substring(0, 10) ==
              SELECTOR_1INCH_UNOSWAP_V3_SWAP ||
              swapData.tx.data.substring(0, 10) == SELECTOR_1INCH_SWAP
          ).to.be.true;
        } else {
          expect(swapData.tx.data.substring(0, 10)).to.be.eq(
            SELECTOR_1INCH_UNOSWAP_V3_SWAP
          );
        }
        // Prepare handler data
        var data = getCallData(HOneInch, 'swap', [
          token0Address,
          value,
          WETH_TOKEN,
          swapData.tx.data,
        ]);
        data = data + appendData;

        // Execute
        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: ether('0.1'),
        });

        // Verify return value
        const wethUserEnd = await this.weth.balanceOf.call(user);
        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );
        expect(handlerReturn).to.be.bignumber.eq(wethUserEnd.sub(wethUser));

        // Verify token0 balance
        expect(await this.token0.balanceOf.call(user)).to.be.bignumber.eq(
          token0User
        );
        expect(
          await this.token0.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.zero;

        // Verify weth balance
        expect(await this.weth.balanceOf.call(user)).to.be.bignumber.gte(
          // sub 1 more percent to tolerate the slippage calculation difference with 1inch
          wethUser.add(mulPercent(quote, 100 - slippage - 1))
        );
        expect(
          await this.weth.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.zero;

        // Verify ether balance
        expect(await balanceProxy.get()).to.be.bignumber.zero;
        expect(await balanceUser.delta()).to.be.bignumber.eq(ether('0'));

        profileGas(receipt);
      });

      it('should revert: wrong dst token(ether)', async function() {
        // Prepare data
        const value = ether('100');
        const to = this.hOneInch.address;
        const slippage = 3;
        const swapReq = queryString.stringifyUrl({
          url: URL_1INCH_SWAP,
          query: {
            fromTokenAddress: token0Address,
            toTokenAddress: token1Address,
            amount: value,
            slippage: slippage,
            disableEstimate: true,
            fromAddress: this.proxy.address,
            // If the route contains only Uniswap and its' forks, tx.data will invoke `unoswapV3`
            protocols: UNOSWAP_V3_PROTOCOLS,
          },
        });

        // Transfer from token to Proxy first
        await this.token0.transfer(this.proxy.address, value, {
          from: providerAddress,
        });
        await this.proxy.updateTokenMock(this.token0.address);

        // Call 1inch API
        const swapResponse = await callExternalApi(swapReq);
        expect(swapResponse.ok, '1inch api response not ok').to.be.true;
        const swapData = await swapResponse.json();
        // Verify it's `unoswapV3` function call
        if (chainId == 10) {
          // Function sig will be SELECTOR_1INCH_UNOSWAP_V3_SWAP or SELECTOR_1INCH_SWAP on Optimism
          expect(
            swapData.tx.data.substring(0, 10) ==
              SELECTOR_1INCH_UNOSWAP_V3_SWAP ||
              swapData.tx.data.substring(0, 10) == SELECTOR_1INCH_SWAP
          ).to.be.true;
        } else {
          expect(swapData.tx.data.substring(0, 10)).to.be.eq(
            SELECTOR_1INCH_UNOSWAP_V3_SWAP
          );
        }

        // Prepare handler data
        const data = getCallData(HOneInch, 'swap', [
          token0Address,
          value,
          NATIVE_TOKEN_ADDRESS,
          swapData.tx.data,
        ]);

        await expectRevert(
          this.proxy.execMock(to, data, { from: user, value: ether('0.1') }),
          '0_HOneInchV5_swap: Invalid output token amount'
        );
      });

      it('should revert: wrong dst token(erc20)', async function() {
        // Prepare data
        const value = ether('100');
        const to = this.hOneInch.address;
        const slippage = 3;
        const swapReq = queryString.stringifyUrl({
          url: URL_1INCH_SWAP,
          query: {
            fromTokenAddress: token0Address,
            toTokenAddress: token1Address,
            amount: value,
            slippage: slippage,
            disableEstimate: true,
            fromAddress: this.proxy.address,
            // If the route contains only Uniswap and its' forks, tx.data will invoke `unoswapV3`
            protocols: UNOSWAP_V3_PROTOCOLS,
          },
        });

        // Transfer from token to Proxy first
        await this.token0.transfer(this.proxy.address, value, {
          from: providerAddress,
        });
        await this.proxy.updateTokenMock(this.token0.address);

        // Call 1inch API
        const swapResponse = await callExternalApi(swapReq);
        expect(swapResponse.ok, '1inch api response not ok').to.be.true;
        const swapData = await swapResponse.json();
        // Verify it's `unoswapV3` function call
        if (chainId == 10) {
          // Function sig will be SELECTOR_1INCH_UNOSWAP_V3_SWAP or SELECTOR_1INCH_SWAP on Optimism
          expect(
            swapData.tx.data.substring(0, 10) ==
              SELECTOR_1INCH_UNOSWAP_V3_SWAP ||
              swapData.tx.data.substring(0, 10) == SELECTOR_1INCH_SWAP
          ).to.be.true;
        } else {
          expect(swapData.tx.data.substring(0, 10)).to.be.eq(
            SELECTOR_1INCH_UNOSWAP_V3_SWAP
          );
        }

        // Prepare handler data
        const data = getCallData(HOneInch, 'swap', [
          token0Address,
          value,
          WETH_TOKEN,
          swapData.tx.data,
        ]);

        await expectRevert(
          this.proxy.execMock(to, data, { from: user, value: ether('0.1') }),
          '0_HOneInchV5_swap: Invalid output token amount'
        );
      });

      it('should revert: wrong src token(ether)', async function() {
        // Prepare data
        const value = ether('100');
        const to = this.hOneInch.address;
        const slippage = 3;
        const swapReq = queryString.stringifyUrl({
          url: URL_1INCH_SWAP,
          query: {
            fromTokenAddress: token0Address,
            toTokenAddress: token1Address,
            amount: value,
            slippage: slippage,
            disableEstimate: true,
            fromAddress: this.proxy.address,
            // If the route contains only Uniswap and its' forks, tx.data will invoke `unoswapV3`
            protocols: UNOSWAP_V3_PROTOCOLS,
          },
        });

        // Transfer from token to Proxy first
        await this.token0.transfer(this.proxy.address, value, {
          from: providerAddress,
        });
        await this.proxy.updateTokenMock(this.token0.address);

        // Call 1inch API
        const swapResponse = await callExternalApi(swapReq);
        expect(swapResponse.ok, '1inch api response not ok').to.be.true;
        const swapData = await swapResponse.json();
        // Verify it's `unoswapV3` function call
        if (chainId == 10) {
          // Function sig will be SELECTOR_1INCH_UNOSWAP_V3_SWAP or SELECTOR_1INCH_SWAP on Optimism
          expect(
            swapData.tx.data.substring(0, 10) ==
              SELECTOR_1INCH_UNOSWAP_V3_SWAP ||
              swapData.tx.data.substring(0, 10) == SELECTOR_1INCH_SWAP
          ).to.be.true;
        } else {
          expect(swapData.tx.data.substring(0, 10)).to.be.eq(
            SELECTOR_1INCH_UNOSWAP_V3_SWAP
          );
        }

        // Prepare handler data
        const data = getCallData(HOneInch, 'swap', [
          NATIVE_TOKEN_ADDRESS,
          value,
          token1Address,
          swapData.tx.data,
        ]);

        await expectRevert.unspecified(
          this.proxy.execMock(to, data, { from: user, value: ether('0.1') })
        );
      });

      it('should revert: wrong src token(erc20)', async function() {
        // Prepare data
        const value = ether('100');
        const to = this.hOneInch.address;
        const slippage = 3;
        const swapReq = queryString.stringifyUrl({
          url: URL_1INCH_SWAP,
          query: {
            fromTokenAddress: token0Address,
            toTokenAddress: token1Address,
            amount: value,
            slippage: slippage,
            disableEstimate: true,
            fromAddress: this.proxy.address,
            // If the route contains only Uniswap and its' forks, tx.data will invoke `unoswapV3`
            protocols: UNOSWAP_V3_PROTOCOLS,
          },
        });

        // Transfer from token to Proxy first
        await this.token0.transfer(this.proxy.address, value, {
          from: providerAddress,
        });
        await this.proxy.updateTokenMock(this.token0.address);

        // Call 1inch API
        const swapResponse = await callExternalApi(swapReq);
        expect(swapResponse.ok, '1inch api response not ok').to.be.true;
        const swapData = await swapResponse.json();
        // Verify it's `unoswapV3` function call
        if (chainId == 10) {
          // Function sig will be SELECTOR_1INCH_UNOSWAP_V3_SWAP or SELECTOR_1INCH_SWAP on Optimism
          expect(
            swapData.tx.data.substring(0, 10) ==
              SELECTOR_1INCH_UNOSWAP_V3_SWAP ||
              swapData.tx.data.substring(0, 10) == SELECTOR_1INCH_SWAP
          ).to.be.true;
        } else {
          expect(swapData.tx.data.substring(0, 10)).to.be.eq(
            SELECTOR_1INCH_UNOSWAP_V3_SWAP
          );
        }

        // Prepare handler data
        const data = getCallData(HOneInch, 'swap', [
          WETH_TOKEN,
          value,
          token1Address,
          swapData.tx.data,
        ]);

        if (chainId == 137) {
          await expectRevert(
            this.proxy.execMock(to, data, { from: user, value: ether('0.1') }),
            '0_HOneInchV5__oneinchswapCall: ERC20: transfer amount exceeds allowance'
          );
        } else {
          await expectRevert(
            this.proxy.execMock(to, data, { from: user, value: ether('0.1') }),
            '0_HOneInchV5__oneinchswapCall: Dai/insufficient-allowance'
          );
        }
      });

      it('should revert: wrong src token amount(erc20)', async function() {
        // Prepare data
        const value = ether('100');
        const to = this.hOneInch.address;
        const slippage = 3;
        const swapReq = queryString.stringifyUrl({
          url: URL_1INCH_SWAP,
          query: {
            fromTokenAddress: token0Address,
            toTokenAddress: token1Address,
            amount: value,
            slippage: slippage,
            disableEstimate: true,
            fromAddress: this.proxy.address,
            // If the route contains only Uniswap and its' forks, tx.data will invoke `unoswapV3`
            protocols: UNOSWAP_V3_PROTOCOLS,
          },
        });

        // Transfer from token to Proxy first
        await this.token0.transfer(this.proxy.address, value, {
          from: providerAddress,
        });
        await this.proxy.updateTokenMock(this.token0.address);

        // Call 1inch API
        const swapResponse = await callExternalApi(swapReq);
        expect(swapResponse.ok, '1inch api response not ok').to.be.true;
        const swapData = await swapResponse.json();
        // Verify it's `unoswapV3` function call
        if (chainId == 10) {
          // Function sig will be SELECTOR_1INCH_UNOSWAP_V3_SWAP or SELECTOR_1INCH_SWAP on Optimism
          expect(
            swapData.tx.data.substring(0, 10) ==
              SELECTOR_1INCH_UNOSWAP_V3_SWAP ||
              swapData.tx.data.substring(0, 10) == SELECTOR_1INCH_SWAP
          ).to.be.true;
        } else {
          expect(swapData.tx.data.substring(0, 10)).to.be.eq(
            SELECTOR_1INCH_UNOSWAP_V3_SWAP
          );
        }
        // Prepare handler data
        const data = getCallData(HOneInch, 'swap', [
          token0Address,
          value.sub(new BN(1000)),
          token1Address,
          swapData.tx.data,
        ]);
        if (chainId == 137) {
          await expectRevert(
            this.proxy.execMock(to, data, { from: user, value: ether('0.1') }),
            '0_HOneInchV5__oneinchswapCall: ERC20: transfer amount exceeds allowance'
          );
        } else {
          await expectRevert(
            this.proxy.execMock(to, data, { from: user, value: ether('0.1') }),
            '0_HOneInchV5__oneinchswapCall: Dai/insufficient-allowance'
          );
        }
      });
    });
  });
});
