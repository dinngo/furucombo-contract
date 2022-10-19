const chainId = network.config.chainId;

if (chainId == 10 || chainId == 42161 || chainId == 43114) {
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
const { ZERO_BYTES32 } = constants;
const abi = require('ethereumjs-abi');
const util = require('ethereumjs-util');
const utils = web3.utils;

const { expect } = require('chai');

const {
  WRAPPED_NATIVE_TOKEN,
  DAI_TOKEN,
  AAVEPROTOCOL_V3_PROVIDER,
  ADAI_V3_DEBT_STABLE,
  ADAI_V3_DEBT_VARIABLE,
  AAVE_RATEMODE,
  WETH_TOKEN,
  AWETH_V3_TOKEN,
} = require('./utils/constants');
const { evmRevert, evmSnapshot, getTokenProvider } = require('./utils/utils');

const FeeRuleRegistry = artifacts.require('FeeRuleRegistry');
const Registry = artifacts.require('Registry');
const Proxy = artifacts.require('ProxyMock');
const HAaveV3 = artifacts.require('HAaveProtocolV3');
const HMock = artifacts.require('HMock');
const Faucet = artifacts.require('Faucet');
const SimpleToken = artifacts.require('SimpleToken');
const IToken = artifacts.require('IERC20');
const IPool = artifacts.require('IPool');
const IProvider = artifacts.require('IPoolAddressesProvider');
const IVariableDebtToken = artifacts.require('IVariableDebtTokenV3');
const IStableDebtToken = artifacts.require('IStableDebtTokenV3');

contract('AaveV3 flashloan', function([_, user, someone]) {
  let id;
  let balanceUser;
  let balanceProxy;

  before(async function() {
    this.feeRuleRegistry = await FeeRuleRegistry.new('0', _);
    this.registry = await Registry.new();
    this.proxy = await Proxy.new(
      this.registry.address,
      this.feeRuleRegistry.address
    );
    // Register aave v3 handler
    this.hAaveV3 = await HAaveV3.new(WRAPPED_NATIVE_TOKEN);
    await this.registry.register(
      this.hAaveV3.address,
      utils.asciiToHex('Aave ProtocolV3')
    );
    // Register mock handler
    this.hMock = await HMock.new();
    await this.registry.register(this.hMock.address, utils.asciiToHex('Mock'));

    // Register aave v3 pool for flashloan
    this.provider = await IProvider.at(AAVEPROTOCOL_V3_PROVIDER);
    const poolAddress = await this.provider.getPool();
    this.pool = await IPool.at(poolAddress);
    await this.registry.registerCaller(poolAddress, this.hAaveV3.address);

    this.faucet = await Faucet.new();
    this.tokenA = await IToken.at(DAI_TOKEN);
    this.tokenB = await IToken.at(WETH_TOKEN);
    this.aTokenB = await IToken.at(AWETH_V3_TOKEN);

    this.tokenAProvider = await getTokenProvider(this.tokenA.address);
    this.tokenBProvider = await getTokenProvider(this.tokenB.address);

    this.stableDebtTokenA = await IStableDebtToken.at(ADAI_V3_DEBT_STABLE);
    this.variableDebtTokenA = await IVariableDebtToken.at(
      ADAI_V3_DEBT_VARIABLE
    );
    this.mockToken = await SimpleToken.new();
  });

  beforeEach(async function() {
    id = await evmSnapshot();
    balanceUser = await tracker(user);
    balanceProxy = await tracker(this.proxy.address);
  });

  afterEach(async function() {
    await evmRevert(id);
  });

  describe('Pool as handler', function() {
    it('Will success if pool is registered as handler', async function() {
      await this.registry.register(this.pool.address, this.hAaveV3.address);
      const to = this.pool.address;
      const data = abi.simpleEncode(
        'initialize(address,bytes)',
        this.registry.address,
        ''
      );
      await this.proxy.execMock(to, data, {
        from: user,
        value: ether('0.1'),
      });
    });

    it('Will revert if pool is registered as caller only', async function() {
      const to = this.pool.address;
      const data = abi.simpleEncode(
        'initialize(address,bytes)',
        this.registry.address,
        ''
      );
      await expectRevert(
        this.proxy.execMock(to, data, {
          from: user,
          value: ether('0.1'),
        }),
        'Invalid handler'
      );
    });
  });

  describe('Normal', function() {
    beforeEach(async function() {
      await this.tokenA.transfer(this.faucet.address, ether('100'), {
        from: this.tokenAProvider,
      });
      await this.tokenB.transfer(this.faucet.address, ether('100'), {
        from: this.tokenBProvider,
      });

      tokenAUser = await this.tokenA.balanceOf(user);
      tokenBUser = await this.tokenB.balanceOf(user);

      const supplyAmount = ether('1000');
      await this.tokenB.approve(this.pool.address, supplyAmount, {
        from: this.tokenBProvider,
      });
      await this.pool.supply(this.tokenB.address, supplyAmount, user, 0, {
        from: this.tokenBProvider,
      });
      // For 1 wei tolerance
      expect(await this.aTokenB.balanceOf(user)).to.be.bignumber.gte(
        new BN(supplyAmount).sub(new BN('1'))
      );
    });

    it('Single asset with no debt', async function() {
      // Get flashloan params
      const value = ether('1');
      const params = _getFlashloanParams(
        [this.hMock.address],
        [ZERO_BYTES32],
        [this.faucet.address],
        [this.tokenA.address],
        [value]
      );

      // Get flashloan handler data
      const to = this.hAaveV3.address;
      const data = _getFlashloanCubeData(
        [this.tokenA.address], // assets
        [value], // amounts
        [AAVE_RATEMODE.NODEBT], // modes
        params
      );

      // Exec proxy
      const receipt = await this.proxy.execMock(to, data, {
        from: user,
        value: ether('0.1'),
      });

      // Verify
      const fee = _getFlashloanFee(value);
      expect(await balanceProxy.get()).to.be.bignumber.zero;
      expect(
        await this.tokenA.balanceOf(this.proxy.address)
      ).to.be.bignumber.zero;
      expect(await this.tokenA.balanceOf(user)).to.be.bignumber.eq(
        tokenAUser.add(value).sub(fee)
      );
      expect(await balanceUser.delta()).to.be.bignumber.eq(ether('0'));
    });

    it('single asset with stable rate by borrowing from itself', async function() {
      // Get flashloan params
      const value = ether('1');
      const params = _getFlashloanParams(
        [this.hMock.address],
        [ZERO_BYTES32],
        [this.faucet.address],
        [this.tokenA.address],
        [value]
      );

      // Get flashloan handler data
      const to = this.hAaveV3.address;
      const data = _getFlashloanCubeData(
        [this.tokenA.address], // assets
        [value], // amounts
        [AAVE_RATEMODE.STABLE], // modes
        params
      );

      // Approve delegation to proxy get the debt
      await this.stableDebtTokenA.approveDelegation(this.proxy.address, value, {
        from: user,
      });

      // Exec proxy
      await balanceUser.get();
      const receipt = await this.proxy.execMock(to, data, {
        from: user,
        value: ether('0.1'),
      });

      // Verify
      expect(await balanceProxy.get()).to.be.bignumber.zero;
      expect(
        await this.tokenA.balanceOf(this.proxy.address)
      ).to.be.bignumber.zero;
      expect(await this.tokenA.balanceOf(user)).to.be.bignumber.eq(
        tokenAUser.add(value).add(value)
      );
      expect(await this.stableDebtTokenA.balanceOf(user)).to.be.bignumber.eq(
        value
      );
      expect(await balanceUser.delta()).to.be.bignumber.eq(ether('0'));
    });

    it('single asset with variable rate by borrowing from itself', async function() {
      // Get flashloan params
      const value = ether('1');
      const params = _getFlashloanParams(
        [this.hMock.address],
        [ZERO_BYTES32],
        [this.faucet.address],
        [this.tokenA.address],
        [value]
      );

      // Get flashloan handler data
      const to = this.hAaveV3.address;
      const data = _getFlashloanCubeData(
        [this.tokenA.address], // assets
        [value], // amounts
        [AAVE_RATEMODE.VARIABLE], // modes
        params
      );

      // approve delegation to proxy get the debt
      await this.variableDebtTokenA.approveDelegation(
        this.proxy.address,
        value,
        {
          from: user,
        }
      );

      // Exec proxy
      await balanceUser.get();
      const receipt = await this.proxy.execMock(to, data, {
        from: user,
        value: ether('0.1'),
      });

      // Verify
      expect(await balanceProxy.get()).to.be.bignumber.zero;
      expect(
        await this.tokenA.balanceOf(this.proxy.address)
      ).to.be.bignumber.zero;
      expect(await this.tokenA.balanceOf(user)).to.be.bignumber.eq(
        tokenAUser.add(value).add(value)
      );
      expect(await this.variableDebtTokenA.balanceOf(user)).to.be.bignumber.eq(
        value
      );
      expect(await balanceUser.delta()).to.be.bignumber.eq(ether('0'));
    });

    it('multiple assets with no debt', async function() {
      // Get flashloan params
      const value = ether('1');
      const params = _getFlashloanParams(
        [this.hMock.address],
        [ZERO_BYTES32],
        [this.faucet.address, this.faucet.address],
        [this.tokenA.address, this.tokenB.address],
        [value, value]
      );

      // Get flashloan handler data
      const to = this.hAaveV3.address;
      const data = _getFlashloanCubeData(
        [this.tokenA.address, this.tokenB.address], // assets
        [value, value], // amounts
        [AAVE_RATEMODE.NODEBT, AAVE_RATEMODE.NODEBT], // modes
        params
      );

      // Exec proxy
      const receipt = await this.proxy.execMock(to, data, {
        from: user,
        value: ether('0.1'),
      });

      // Verify proxy balance
      expect(await balanceProxy.get()).to.be.bignumber.zero;
      expect(
        await this.tokenA.balanceOf(this.proxy.address)
      ).to.be.bignumber.zero;
      expect(
        await this.tokenB.balanceOf(this.proxy.address)
      ).to.be.bignumber.zero;

      // Verify user balance
      const fee = _getFlashloanFee(value);
      expect(await this.tokenA.balanceOf(user)).to.be.bignumber.eq(
        tokenAUser.add(value).sub(fee)
      );
      expect(await this.tokenB.balanceOf(user)).to.be.bignumber.eq(
        tokenBUser.add(value).sub(fee)
      );
      expect(await balanceUser.delta()).to.be.bignumber.eq(ether('0'));
    });

    it('should revert: assets and amount do not match', async function() {
      const value = ether('1');
      const params = _getFlashloanParams(
        [this.hMock.address],
        [ZERO_BYTES32],
        [this.faucet.address, this.faucet.address],
        [this.tokenA.address, this.tokenB.address],
        [value, value]
      );

      const to = this.hAaveV3.address;
      const data = _getFlashloanCubeData(
        [this.tokenA.address, this.tokenB.address], // assets
        [value], // amounts
        [AAVE_RATEMODE.NODEBT, AAVE_RATEMODE.NODEBT], // modes
        params
      );

      await expectRevert(
        this.proxy.execMock(to, data, {
          from: user,
          value: ether('0.1'),
        }),
        'HAaveProtocolV3_flashLoan: assets and amounts do not match'
      );
    });

    it('should revert: assets and modes do not match', async function() {
      const value = ether('1');
      const params = _getFlashloanParams(
        [this.hMock.address],
        [ZERO_BYTES32],
        [this.faucet.address, this.faucet.address],
        [this.tokenA.address, this.tokenB.address],
        [value, value]
      );

      const to = this.hAaveV3.address;
      const data = _getFlashloanCubeData(
        [this.tokenA.address, this.tokenB.address], // assets
        [value, value], // amounts
        [AAVE_RATEMODE.NODEBT], // modes
        params
      );

      await expectRevert(
        this.proxy.execMock(to, data, {
          from: user,
          value: ether('0.1'),
        }),
        'HAaveProtocolV3_flashLoan: assets and modes do not match'
      );
    });

    it('should revert: not approveDelegation to proxy', async function() {
      const value = ether('1');
      const params = _getFlashloanParams(
        [this.hMock.address],
        [ZERO_BYTES32],
        [this.faucet.address],
        [this.tokenA.address],
        [value]
      );

      const to = this.hAaveV3.address;
      const data = _getFlashloanCubeData(
        [this.tokenA.address], // assets
        [value], // amounts
        [AAVE_RATEMODE.VARIABLE], // modes
        params
      );

      await expectRevert(
        this.proxy.execMock(to, data, {
          from: user,
          value: ether('0.1'),
        }),
        'HAaveProtocolV3_flashLoan: Unspecified'
      );
    });

    it('should revert: collateral same as borrowing currency', async function() {
      const value = ether('1');
      const params = _getFlashloanParams(
        [this.hMock.address],
        [ZERO_BYTES32],
        [this.faucet.address],
        [this.tokenB.address],
        [value]
      );

      const to = this.hAaveV3.address;
      const data = _getFlashloanCubeData(
        [this.tokenB.address], // assets
        [value], // amounts
        [AAVE_RATEMODE.VARIABLE], // modes
        params
      );
      await expectRevert(
        this.proxy.execMock(to, data, {
          from: user,
          value: ether('0.1'),
        }),
        'AaveProtocolV3_flashLoan: Unspecified'
      );
    });

    it('should revert: not supported token', async function() {
      const value = ether('1');
      const params = _getFlashloanParams(
        [this.hMock.address],
        [ZERO_BYTES32],
        [this.faucet.address],
        [this.tokenA.address],
        [value]
      );

      const to = this.hAaveV3.address;
      const data = _getFlashloanCubeData(
        [this.mockToken.address], // assets
        [value], // amounts
        [AAVE_RATEMODE.STABLE], // modes
        params
      );

      await expectRevert(
        this.proxy.execMock(to, data, {
          from: user,
          value: ether('0.1'),
        }),
        'HAaveProtocolV3_flashLoan: 27' // AAVEV3 Error Code: RESERVE_INACTIVE
      );
    });
  });

  describe('Multiple Cubes', function() {
    beforeEach(async function() {
      tokenAUser = await this.tokenA.balanceOf(user);
      tokenBUser = await this.tokenB.balanceOf(user);
      await this.tokenA.transfer(this.faucet.address, ether('100'), {
        from: this.tokenAProvider,
      });
      await this.tokenB.transfer(this.faucet.address, ether('100'), {
        from: this.tokenBProvider,
      });
    });

    it('sequential', async function() {
      const value = ether('1');
      // Setup 1st flashloan cube
      const params1 = _getFlashloanParams(
        [this.hMock.address],
        [ZERO_BYTES32],
        [this.faucet.address, this.faucet.address],
        [this.tokenA.address, this.tokenB.address],
        [value, value]
      );

      const to1 = this.hAaveV3.address;
      const data1 = _getFlashloanCubeData(
        [this.tokenA.address, this.tokenB.address], // assets
        [value, value], // amounts
        [AAVE_RATEMODE.NODEBT, AAVE_RATEMODE.NODEBT], // modes
        params1
      );

      // Setup 2nd flashloan cube
      const params2 = _getFlashloanParams(
        [this.hMock.address],
        [ZERO_BYTES32],
        [this.faucet.address, this.faucet.address],
        [this.tokenA.address, this.tokenB.address],
        [value, value]
      );

      const to2 = this.hAaveV3.address;
      const data2 = _getFlashloanCubeData(
        [this.tokenA.address, this.tokenB.address], // assets
        [value, value], // amounts
        [AAVE_RATEMODE.NODEBT, AAVE_RATEMODE.NODEBT], // modes
        params2
      );

      // Execute proxy batchExec
      const to = [to1, to2];
      const config = [ZERO_BYTES32, ZERO_BYTES32];
      const data = [data1, data2];
      const receipt = await this.proxy.batchExec(to, config, data, [], {
        from: user,
        value: ether('0.1'),
      });

      // Verify proxy balance
      expect(await balanceProxy.get()).to.be.bignumber.zero;
      expect(
        await this.tokenA.balanceOf(this.proxy.address)
      ).to.be.bignumber.zero;
      expect(
        await this.tokenB.balanceOf(this.proxy.address)
      ).to.be.bignumber.zero;

      // Verify user balance
      const fee = _getFlashloanFee(value.mul(new BN('2')));
      expect(await this.tokenA.balanceOf(user)).to.be.bignumber.eq(
        tokenAUser.add(value.add(value)).sub(fee)
      );
      expect(await this.tokenB.balanceOf(user)).to.be.bignumber.eq(
        tokenBUser.add(value.add(value)).sub(fee)
      );
      expect(await balanceUser.delta()).to.be.bignumber.eq(ether('0'));
    });

    it('nested', async function() {
      // Get flashloan params
      const value = ether('1');
      const params1 = _getFlashloanParams(
        [this.hMock.address],
        [ZERO_BYTES32],
        [this.faucet.address, this.faucet.address],
        [this.tokenA.address, this.tokenB.address],
        [value, value]
      );

      // Get 1st flashloan cube data
      const data1 = _getFlashloanCubeData(
        [this.tokenA.address, this.tokenB.address], // assets
        [value, value], // amounts
        [AAVE_RATEMODE.NODEBT, AAVE_RATEMODE.NODEBT], // modes
        params1
      );

      // Encode 1st flashloan cube data as flashloan param
      const params2 = web3.eth.abi.encodeParameters(
        ['address[]', 'bytes32[]', 'bytes[]'],
        [[this.hAaveV3.address], [ZERO_BYTES32], [data1]]
      );

      // Get 2nd flashloan cube data
      const data2 = _getFlashloanCubeData(
        [this.tokenA.address, this.tokenB.address], // assets
        [value, value], // amounts
        [AAVE_RATEMODE.NODEBT, AAVE_RATEMODE.NODEBT], // modes
        params2
      );

      // Execute proxy batchExec
      const to = [this.hAaveV3.address];
      const config = [ZERO_BYTES32];
      const data = [data2];
      const receipt = await this.proxy.batchExec(to, config, data, [], {
        from: user,
        value: ether('0.1'),
      });

      // Verify proxy balance
      expect(await balanceProxy.get()).to.be.bignumber.zero;
      expect(
        await this.tokenA.balanceOf(this.proxy.address)
      ).to.be.bignumber.zero;
      expect(
        await this.tokenB.balanceOf(this.proxy.address)
      ).to.be.bignumber.zero;

      // Verify user balance
      const fee = _getFlashloanFee(value.mul(new BN('2')));
      expect(await this.tokenA.balanceOf(user)).to.be.bignumber.eq(
        tokenAUser.add(value).sub(fee)
      );
      expect(await this.tokenB.balanceOf(user)).to.be.bignumber.eq(
        tokenBUser.add(value).sub(fee)
      );
      expect(await balanceUser.delta()).to.be.bignumber.eq(ether('0'));
    });
  });

  describe('supply', function() {
    beforeEach(async function() {
      tokenAUser = await this.tokenA.balanceOf(user);
      tokenBUser = await this.tokenB.balanceOf(user);
      await this.tokenA.transfer(this.faucet.address, ether('100'), {
        from: this.tokenAProvider,
      });
      await this.tokenB.transfer(this.faucet.address, ether('100'), {
        from: this.tokenBProvider,
      });
    });

    it('supply aaveV3 after flashloan', async function() {
      // Get flashloan params
      const value = ether('1');
      const supplyValue = ether('0.5');
      const testTo1 = [this.hMock.address, this.hAaveV3.address];
      const testConfig1 = [ZERO_BYTES32, ZERO_BYTES32];
      const testData1 = [
        '0x' +
          abi
            .simpleEncode(
              'drainTokens(address[],address[],uint256[])',
              [this.faucet.address, this.faucet.address],
              [this.tokenA.address, this.tokenB.address],
              [value, value]
            )
            .toString('hex'),
        abi.simpleEncode(
          'supply(address,uint256)',
          this.tokenB.address,
          supplyValue
        ),
      ];

      const params1 = web3.eth.abi.encodeParameters(
        ['address[]', 'bytes32[]', 'bytes[]'],
        [testTo1, testConfig1, testData1]
      );

      // Get flashloan cube data
      const data1 = _getFlashloanCubeData(
        [this.tokenA.address, this.tokenB.address], // assets
        [value, value], // amounts
        [AAVE_RATEMODE.NODEBT, AAVE_RATEMODE.NODEBT], // modes
        params1
      );

      // Execute proxy batchExec
      const to = [this.hAaveV3.address];
      const config = [ZERO_BYTES32];
      const data = [data1];
      const receipt = await this.proxy.batchExec(to, config, data, [], {
        from: user,
        value: ether('0.1'),
      });

      // Verify proxy balance
      expect(await balanceProxy.get()).to.be.bignumber.zero;
      expect(
        await this.tokenA.balanceOf(this.proxy.address)
      ).to.be.bignumber.zero;
      expect(
        await this.tokenB.balanceOf(this.proxy.address)
      ).to.be.bignumber.zero;

      // Verify user balance
      const fee = _getFlashloanFee(value);
      expect(await this.tokenA.balanceOf(user)).to.be.bignumber.eq(
        tokenAUser.add(value).sub(fee)
      );
      expect(await this.tokenB.balanceOf(user)).to.be.bignumber.eq(
        tokenBUser.add(value.sub(supplyValue).sub(fee))
      );
      expect(await balanceUser.delta()).to.be.bignumber.eq(ether('0'));
    });
  });

  describe('Non-proxy', function() {
    beforeEach(async function() {
      await this.tokenA.transfer(this.faucet.address, ether('100'), {
        from: this.tokenAProvider,
      });
    });

    it('should revert: not initiated by the proxy', async function() {
      const value = ether('1');
      // Setup 1st flashloan cube
      const params = _getFlashloanParams(
        [this.hMock.address],
        [ZERO_BYTES32],
        [this.faucet.address],
        [this.tokenA.address],
        [value]
      );

      await expectRevert(
        this.pool.flashLoan(
          this.proxy.address,
          [this.tokenA.address],
          [value],
          [AAVE_RATEMODE.NODEBT],
          someone,
          params,
          0,
          { from: someone }
        ),
        'Sender is not initialized'
      );
    });
  });

  describe('executeOperation', function() {
    it('should revert: non-pool call executeOperation() directly', async function() {
      const data = abi.simpleEncode(
        'executeOperation(address[],uint256[],uint256[],address,bytes)',
        [],
        [],
        [],
        this.proxy.address,
        util.toBuffer(0)
      );
      const to = this.hAaveV3.address;
      await expectRevert(
        this.proxy.execMock(to, data, {
          from: user,
        }),
        'HAaveProtocolV3_executeOperation: invalid caller'
      );
    });
  });
});

function _getFlashloanParams(tos, configs, faucets, tokens, amounts) {
  const data = [
    '0x' +
      abi
        .simpleEncode(
          'drainTokens(address[],address[],uint256[])',
          faucets,
          tokens,
          amounts
        )
        .toString('hex'),
  ];

  const params = web3.eth.abi.encodeParameters(
    ['address[]', 'bytes32[]', 'bytes[]'],
    [tos, configs, data]
  );
  return params;
}

function _getFlashloanCubeData(assets, amounts, modes, params) {
  const data = abi.simpleEncode(
    'flashLoan(address[],uint256[],uint256[],bytes)',
    assets,
    amounts,
    modes,
    util.toBuffer(params)
  );
  return data;
}

function _getFlashloanFee(value) {
  return value.mul(new BN('5')).div(new BN('10000'));
}
