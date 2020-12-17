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
const { ZERO_BYTES32, ZERO_ADDRESS } = constants;
const { latest } = time;
const abi = require('ethereumjs-abi');
const util = require('ethereumjs-util');
const utils = web3.utils;

const { expect } = require('chai');

const {
  ETH_PROVIDER,
  WETH_TOKEN,
  WETH_PROVIDER,
  DAI_TOKEN,
  DAI_PROVIDER,
  AAVEPROTOCOL_V2_PROVIDER,
} = require('./utils/constants');
const { evmRevert, evmSnapshot, profileGas } = require('./utils/utils');

const HAave = artifacts.require('HAaveProtocol');
const HAaveV2 = artifacts.require('HAaveProtocolV2');
const HMock = artifacts.require('HMock');
const HUniswap = artifacts.require('HUniswap');
const Registry = artifacts.require('Registry');
const Proxy = artifacts.require('ProxyMock');
const IToken = artifacts.require('IERC20');
const ILendingPoolV2 = artifacts.require('ILendingPoolV2');
const IProviderV2 = artifacts.require('ILendingPoolAddressesProviderV2');
const IUniswapExchange = artifacts.require('IUniswapExchange');
const Faucet = artifacts.require('Faucet');

contract('AaveV2 flashloan', function([_, user]) {
  let id;
  let balanceUser;
  let balanceProxy;

  before(async function() {
    this.registry = await Registry.new();
    this.proxy = await Proxy.new(this.registry.address);
    this.hAave = await HAave.new();
    this.hAaveV2 = await HAaveV2.new();
    await this.registry.register(
      this.hAaveV2.address,
      utils.asciiToHex('Aave ProtocolV2')
    );
    await this.registry.register(
      this.hAave.address,
      utils.asciiToHex('Aave Protocol')
    );
    this.hMock = await HMock.new();
    await this.registry.register(this.hMock.address, utils.asciiToHex('Mock'));

    this.provider = await IProviderV2.at(AAVEPROTOCOL_V2_PROVIDER);
    const lendingPoolAddress = await this.provider.getLendingPool.call();
    this.lendingPool = await ILendingPoolV2.at(lendingPoolAddress);
    await this.registry.register(lendingPoolAddress, this.hAaveV2.address);
    this.faucet = await Faucet.new();
    this.tokenA = await IToken.at(WETH_TOKEN);
    this.tokenB = await IToken.at(DAI_TOKEN);
    this.tokenAProvider = WETH_PROVIDER;
    this.tokenBProvider = DAI_PROVIDER;
  });

  beforeEach(async function() {
    id = await evmSnapshot();
    balanceUser = await tracker(user);
    balanceProxy = await tracker(this.proxy.address);
  });

  afterEach(async function() {
    await evmRevert(id);
  });

  describe('Normal', function() {
    beforeEach(async function() {
      tokenAUser = await this.tokenA.balanceOf.call(user);
      tokenBUser = await this.tokenB.balanceOf.call(user);
      await this.tokenA.transfer(this.faucet.address, ether('100'), {
        from: this.tokenAProvider,
      });
      await this.tokenB.transfer(this.faucet.address, ether('100'), {
        from: this.tokenBProvider,
      });
    });

    // TODO: single asset with stable
    // TODO: single asset with variable
    // TODO: multiple assets with stable
    // TODO: multiple assets with variable

    it('single asset with no debt', async function() {
      const value = ether('1');
      const testTo = [this.hMock.address];
      const testConfig = [ZERO_BYTES32];
      const testData = [
        '0x' +
          abi
            .simpleEncode(
              'drainToken(address,address,uint256)',
              this.faucet.address,
              this.tokenA.address,
              value
            )
            .toString('hex'),
      ];

      const params = web3.eth.abi.encodeParameters(
        ['address[]', 'bytes32[]', 'bytes[]'],
        [testTo, testConfig, testData]
      );

      const assets = [this.tokenA.address];
      const amounts = [ether('1')];
      const modes = [ether('0')];
      const onBehalfOf = ZERO_ADDRESS;
      const to = this.hAaveV2.address;
      const data = abi.simpleEncode(
        'flashLoan(address[],uint256[],uint256[],address,bytes)',
        assets,
        amounts,
        modes,
        onBehalfOf,
        util.toBuffer(params)
      );

      const receipt = await this.proxy.execMock(to, data, {
        from: user,
        value: ether('0.1'),
      });

      expect(await balanceProxy.get()).to.be.zero;
      expect(await this.tokenA.balanceOf.call(this.proxy.address)).to.be.zero;
      expect(await this.tokenA.balanceOf.call(user)).to.be.bignumber.eq(
        tokenAUser.add(value).sub(value.mul(new BN('9')).div(new BN('10000')))
      );
      expect(await balanceUser.delta()).to.be.bignumber.eq(
        ether('0').sub(new BN(receipt.receipt.gasUsed))
      );
    });

    it('multiple assets with no debt', async function() {
      const value = ether('1');
      const testTo = [this.hMock.address];
      const testConfig = [ZERO_BYTES32];
      const testData = [
        '0x' +
          abi
            .simpleEncode(
              'drainTokens(address[],address[],uint256[])',
              [this.faucet.address, this.faucet.address],
              [this.tokenA.address, this.tokenB.address],
              [value, value]
            )
            .toString('hex'),
      ];

      const params = web3.eth.abi.encodeParameters(
        ['address[]', 'bytes32[]', 'bytes[]'],
        [testTo, testConfig, testData]
      );

      const assets = [this.tokenA.address, this.tokenB.address];
      const amounts = [value, value];
      const modes = [0, 0];
      const onBehalfOf = ZERO_ADDRESS;
      const to = this.hAaveV2.address;
      const data = abi.simpleEncode(
        'flashLoan(address[],uint256[],uint256[],address,bytes)',
        assets,
        amounts,
        modes,
        onBehalfOf,
        util.toBuffer(params)
      );

      const receipt = await this.proxy.execMock(to, data, {
        from: user,
        value: ether('0.1'),
      });

      expect(await balanceProxy.get()).to.be.zero;
      expect(await this.tokenA.balanceOf.call(this.proxy.address)).to.be.zero;
      expect(await this.tokenB.balanceOf.call(this.proxy.address)).to.be.zero;
      expect(await this.tokenA.balanceOf.call(user)).to.be.bignumber.eq(
        tokenAUser.add(value).sub(value.mul(new BN('9')).div(new BN('10000')))
      );
      expect(await this.tokenB.balanceOf.call(user)).to.be.bignumber.eq(
        tokenBUser.add(value).sub(value.mul(new BN('9')).div(new BN('10000')))
      );
      expect(await balanceUser.delta()).to.be.bignumber.eq(
        ether('0').sub(new BN(receipt.receipt.gasUsed))
      );
    });

    it('should revert: assets and amount do not match', async function() {
      const value = ether('1');
      const testTo = [this.hMock.address];
      const testConfig = [ZERO_BYTES32];
      const testData = [
        '0x' +
          abi
            .simpleEncode(
              'drainTokens(address[],address[],uint256[])',
              [this.faucet.address, this.faucet.address],
              [this.tokenA.address, this.tokenB.address],
              [value, value]
            )
            .toString('hex'),
      ];

      const params = web3.eth.abi.encodeParameters(
        ['address[]', 'bytes32[]', 'bytes[]'],
        [testTo, testConfig, testData]
      );

      const assets = [this.tokenA.address, this.tokenB.address];
      const amounts = [value];
      const modes = [0, 0];
      const onBehalfOf = ZERO_ADDRESS;
      const to = this.hAaveV2.address;
      const data = abi.simpleEncode(
        'flashLoan(address[],uint256[],uint256[],address,bytes)',
        assets,
        amounts,
        modes,
        onBehalfOf,
        util.toBuffer(params)
      );

      await expectRevert(
        this.proxy.execMock(to, data, {
          from: user,
          value: ether('0.1'),
        }),
        'HAaveProtocolV2_flashLoan: assets and amounts do not match'
      );
    });

    it('should revert: assets and modes do not match', async function() {
      const value = ether('1');
      const testTo = [this.hMock.address];
      const testConfig = [ZERO_BYTES32];
      const testData = [
        '0x' +
          abi
            .simpleEncode(
              'drainTokens(address[],address[],uint256[])',
              [this.faucet.address, this.faucet.address],
              [this.tokenA.address, this.tokenB.address],
              [value, value]
            )
            .toString('hex'),
      ];

      const params = web3.eth.abi.encodeParameters(
        ['address[]', 'bytes32[]', 'bytes[]'],
        [testTo, testConfig, testData]
      );

      const assets = [this.tokenA.address, this.tokenB.address];
      const amounts = [value, value];
      const modes = [0];
      const onBehalfOf = ZERO_ADDRESS;
      const to = this.hAaveV2.address;
      const data = abi.simpleEncode(
        'flashLoan(address[],uint256[],uint256[],address,bytes)',
        assets,
        amounts,
        modes,
        onBehalfOf,
        util.toBuffer(params)
      );

      await expectRevert(
        this.proxy.execMock(to, data, {
          from: user,
          value: ether('0.1'),
        }),
        'HAaveProtocolV2_flashLoan: assets and modes do not match'
      );
    });
  });

  describe('Multiple Cubes', function() {
    beforeEach(async function() {
      tokenAUser = await this.tokenA.balanceOf.call(user);
      tokenBUser = await this.tokenB.balanceOf.call(user);
      await this.tokenA.transfer(this.faucet.address, ether('100'), {
        from: this.tokenAProvider,
      });
      await this.tokenB.transfer(this.faucet.address, ether('100'), {
        from: this.tokenBProvider,
      });
    });

    it('sequential', async function() {
      const value = ether('1');
      const testTo1 = [this.hMock.address];
      const testConfig1 = [ZERO_BYTES32];
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
      ];

      const params1 = web3.eth.abi.encodeParameters(
        ['address[]', 'bytes32[]', 'bytes[]'],
        [testTo1, testConfig1, testData1]
      );

      const assets1 = [this.tokenA.address, this.tokenB.address];
      const amounts1 = [value, value];
      const modes1 = [0, 0];
      const onBehalfOf = ZERO_ADDRESS;
      const data1 = abi.simpleEncode(
        'flashLoan(address[],uint256[],uint256[],address,bytes)',
        assets1,
        amounts1,
        modes1,
        onBehalfOf,
        util.toBuffer(params1)
      );

      const testTo2 = [this.hMock.address];
      const testConfig2 = [ZERO_BYTES32];
      const testData2 = [
        '0x' +
          abi
            .simpleEncode(
              'drainTokens(address[],address[],uint256[])',
              [this.faucet.address, this.faucet.address],
              [this.tokenA.address, this.tokenB.address],
              [value, value]
            )
            .toString('hex'),
      ];

      const params2 = web3.eth.abi.encodeParameters(
        ['address[]', 'bytes32[]', 'bytes[]'],
        [testTo2, testConfig2, testData2]
      );

      const assets2 = [this.tokenA.address, this.tokenB.address];
      const amounts2 = [value, value];
      const modes2 = [0, 0];
      const onBehalfOf2 = ZERO_ADDRESS;
      const data2 = abi.simpleEncode(
        'flashLoan(address[],uint256[],uint256[],address,bytes)',
        assets2,
        amounts2,
        modes2,
        onBehalfOf2,
        util.toBuffer(params2)
      );

      const to = [this.hAaveV2.address, this.hAaveV2.address];
      const config = [ZERO_BYTES32, ZERO_BYTES32];
      const data = [data1, data2];

      const receipt = await this.proxy.batchExec(to, config, data, {
        from: user,
        value: ether('0.1'),
      });

      expect(await balanceProxy.get()).to.be.zero;
      expect(await this.tokenA.balanceOf.call(this.proxy.address)).to.be.zero;
      expect(await this.tokenB.balanceOf.call(this.proxy.address)).to.be.zero;

      const fee = value
        .mul(new BN('9'))
        .div(new BN('10000'))
        .mul(new BN('2'));

      expect(await this.tokenA.balanceOf.call(user)).to.be.bignumber.eq(
        tokenAUser.add(value.add(value)).sub(fee)
      );
      expect(await this.tokenB.balanceOf.call(user)).to.be.bignumber.eq(
        tokenBUser.add(value.add(value)).sub(fee)
      );
      expect(await balanceUser.delta()).to.be.bignumber.eq(
        ether('0').sub(new BN(receipt.receipt.gasUsed))
      );
    });

    it('nested', async function() {
      const value = ether('1');
      const onBehalfOf = ZERO_ADDRESS;
      const testTo = [this.hMock.address];
      const testConfig = [ZERO_BYTES32];
      const testData = [
        '0x' +
          abi
            .simpleEncode(
              'drainTokens(address[],address[],uint256[])',
              [this.faucet.address, this.faucet.address],
              [this.tokenA.address, this.tokenB.address],
              [value, value]
            )
            .toString('hex'),
      ];

      const params = web3.eth.abi.encodeParameters(
        ['address[]', 'bytes32[]', 'bytes[]'],
        [testTo, testConfig, testData]
      );

      const assets1 = [this.tokenA.address, this.tokenB.address];
      const amounts1 = [value, value];
      const modes1 = [0, 0];
      const data1 = abi.simpleEncode(
        'flashLoan(address[],uint256[],uint256[],address,bytes)',
        assets1,
        amounts1,
        modes1,
        onBehalfOf,
        util.toBuffer(params)
      );

      const params2 = web3.eth.abi.encodeParameters(
        ['address[]', 'bytes32[]', 'bytes[]'],
        [[this.hAaveV2.address], [ZERO_BYTES32], [data1]]
      );

      const assets2 = [this.tokenA.address, this.tokenB.address];
      const amounts2 = [value, value];
      const modes2 = [0, 0];
      const data2 = abi.simpleEncode(
        'flashLoan(address[],uint256[],uint256[],address,bytes)',
        assets2,
        amounts2,
        modes2,
        onBehalfOf,
        util.toBuffer(params2)
      );

      const to = [this.hAaveV2.address];
      const config = [ZERO_BYTES32];
      const data = [data2];

      const receipt = await this.proxy.batchExec(to, config, data, {
        from: user,
        value: ether('0.1'),
      });

      expect(await balanceProxy.get()).to.be.zero;
      expect(await this.tokenA.balanceOf.call(this.proxy.address)).to.be.zero;
      expect(await this.tokenB.balanceOf.call(this.proxy.address)).to.be.zero;

      const fee = value
        .mul(new BN('9'))
        .div(new BN('10000'))
        .mul(new BN('2'));

      expect(await this.tokenA.balanceOf.call(user)).to.be.bignumber.eq(
        tokenAUser.add(value).sub(fee)
      );
      expect(await this.tokenB.balanceOf.call(user)).to.be.bignumber.eq(
        tokenBUser.add(value).sub(fee)
      );
      expect(await balanceUser.delta()).to.be.bignumber.eq(
        ether('0').sub(new BN(receipt.receipt.gasUsed))
      );
    });
  });

  describe('Interact with AaveV1 cube', function() {
    beforeEach(async function() {
      tokenAUser = await this.tokenA.balanceOf.call(user);
      tokenBUser = await this.tokenB.balanceOf.call(user);
      await this.tokenA.transfer(this.faucet.address, ether('100'), {
        from: this.tokenAProvider,
      });
      await this.tokenB.transfer(this.faucet.address, ether('100'), {
        from: this.tokenBProvider,
      });
    });

    it('deposit aaveV1', async function() {
      const value = ether('1');
      const depositValue = ether('0.5');
      const testTo1 = [this.hMock.address, this.hAave.address];
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
          'deposit(address,uint256)',
          this.tokenB.address,
          depositValue
        ),
      ];

      const params1 = web3.eth.abi.encodeParameters(
        ['address[]', 'bytes32[]', 'bytes[]'],
        [testTo1, testConfig1, testData1]
      );

      const assets1 = [this.tokenA.address, this.tokenB.address];
      const amounts1 = [value, value];
      const modes1 = [0, 0];
      const onBehalfOf = ZERO_ADDRESS;
      const data1 = abi.simpleEncode(
        'flashLoan(address[],uint256[],uint256[],address,bytes)',
        assets1,
        amounts1,
        modes1,
        onBehalfOf,
        util.toBuffer(params1)
      );

      const to = [this.hAaveV2.address];
      const config = [ZERO_BYTES32];
      const data = [data1];

      const receipt = await this.proxy.batchExec(to, config, data, {
        from: user,
        value: ether('0.1'),
      });

      expect(await balanceProxy.get()).to.be.zero;
      expect(await this.tokenA.balanceOf.call(this.proxy.address)).to.be.zero;
      expect(await this.tokenB.balanceOf.call(this.proxy.address)).to.be.zero;

      const fee = value.mul(new BN('9')).div(new BN('10000'));
      expect(await this.tokenA.balanceOf.call(user)).to.be.bignumber.eq(
        tokenAUser.add(value).sub(fee)
      );
      expect(await this.tokenB.balanceOf.call(user)).to.be.bignumber.eq(
        tokenBUser.add(value.sub(depositValue).sub(fee))
      );
      expect(await balanceUser.delta()).to.be.bignumber.eq(
        ether('0').sub(new BN(receipt.receipt.gasUsed))
      );
    });
  });
});
