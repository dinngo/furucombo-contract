const chainId = network.config.chainId;

if (chainId == 1 || chainId == 10 || chainId == 42161 || chainId == 43114) {
  // This test supports to run on these chains.
} else {
  return;
}

const {
  BN,
  constants,
  ether,
  expectRevert,
} = require('@openzeppelin/test-helpers');
const { ZERO_BYTES32 } = constants;
const utils = web3.utils;
const {
  AAVEPROTOCOL_V2_PROVIDER,
  AAVEPROTOCOL_V3_PROVIDER,
  AAVE_RATEMODE,
  WRAPPED_NATIVE_TOKEN,
} = require('./utils/constants');
const { evmRevert, evmSnapshot, getCallData } = require('./utils/utils');

const FeeRuleRegistry = artifacts.require('FeeRuleRegistry');
const Registry = artifacts.require('Registry');
const Proxy = artifacts.require('Proxy');
const HAaveV2 = artifacts.require('HAaveProtocolV2');
const HAaveV3 = artifacts.require('HAaveProtocolV3');

const HWrapper = artifacts.require('HWrappedNativeToken');
const IProviderV2 = artifacts.require('ILendingPoolAddressesProviderV2');
const IProviderV3 = artifacts.require('IPoolAddressesProvider');

contract('CubeCounting', function([_, user]) {
  const wrappedTokenAddress = WRAPPED_NATIVE_TOKEN;

  let id;

  before(async function() {
    this.registry = await Registry.new();

    this.feeRuleRegistry = await FeeRuleRegistry.new('0', _);
    this.proxy = await Proxy.new(
      this.registry.address,
      this.feeRuleRegistry.address
    );

    // Register wrapper handler
    this.hWrapper = await HWrapper.new(wrappedTokenAddress);
    await this.registry.register(
      this.hWrapper.address,
      utils.asciiToHex('HWrapper')
    );
    if (chainId == 1) {
      // Register aave v2 handler and caller
      this.hAaveV2 = await HAaveV2.new();
      await this.registry.register(
        this.hAaveV2.address,
        utils.asciiToHex('HAaveProtocolV2')
      );
      this.provider = await IProviderV2.at(AAVEPROTOCOL_V2_PROVIDER);
      const lendingPoolAddress = await this.provider.getLendingPool.call();
      await this.registry.registerCaller(
        lendingPoolAddress,
        this.hAaveV2.address
      );
    } else {
      this.hAaveV3 = await HAaveV3.new(wrappedTokenAddress);
      await this.registry.register(
        this.hAaveV3.address,
        utils.asciiToHex('HAaveProtocolV3')
      );
      this.provider = await IProviderV3.at(AAVEPROTOCOL_V3_PROVIDER);
      const poolAddress = await this.provider.getPool.call();
      await this.registry.registerCaller(poolAddress, this.hAaveV3.address);
    }
  });

  beforeEach(async function() {
    id = await evmSnapshot();
  });

  afterEach(async function() {
    await evmRevert(id);
  });

  describe('Wrapper', function() {
    it('simply revert', async function() {
      const value = ether('1');
      const to = [this.hWrapper.address];
      const config = [ZERO_BYTES32];
      const data = [getCallData(HWrapper, 'deposit', [value])];
      await expectRevert(
        this.proxy.batchExec(to, config, data, [], {
          from: user,
          value: 0, // Insufficient native token
        }),
        '0_HWrappedNativeToken_deposit: Unspecified'
      );
    });
  });

  describe('FlashLoan', function() {
    it('silently revert', async function() {
      if (chainId == 1) {
        // FlashLoan with invalid callback data
        const value = ether('1');
        const to = [this.hAaveV2.address];
        const config = [ZERO_BYTES32];

        // Prepare data
        const flashLoanData = web3.eth.abi.encodeParameters(['bytes'], ['0x']);
        const data = [
          getCallData(HAaveV2, 'flashLoan', [
            [wrappedTokenAddress],
            [value],
            [AAVE_RATEMODE.NODEBT],
            flashLoanData,
          ]),
        ];

        await expectRevert(
          this.proxy.batchExec(to, config, data, [], {
            from: user,
          }),
          '0_HAaveProtocolV2_flashLoan: _exec'
        );
      } else {
        // FlashLoan with invalid callback data
        const value = ether('1');
        const to = [this.hAaveV3.address];
        const config = [ZERO_BYTES32];

        // Prepare data
        const flashLoanData = web3.eth.abi.encodeParameters(['bytes'], ['0x']);
        const data = [
          getCallData(HAaveV3, 'flashLoan', [
            [wrappedTokenAddress],
            [value],
            [AAVE_RATEMODE.NODEBT],
            flashLoanData,
          ]),
        ];

        await expectRevert(
          this.proxy.batchExec(to, config, data, [], {
            from: user,
          }),
          '0_HAaveProtocolV3_flashLoan: _exec'
        );
      }
    });

    it('insufficient fee revert', async function() {
      if (chainId == 1) {
        // FlashLoan with empty callback data
        const value = ether('1');
        const to = [this.hAaveV2.address];
        const config = [ZERO_BYTES32];

        // Prepare data
        const flashLoanData = web3.eth.abi.encodeParameters(
          ['address[]', 'bytes32[]', 'bytes[]'],
          [[], [], []]
        );
        const data = [
          getCallData(HAaveV2, 'flashLoan', [
            [wrappedTokenAddress],
            [value],
            [AAVE_RATEMODE.NODEBT],
            flashLoanData,
          ]),
        ];

        await expectRevert(
          this.proxy.batchExec(to, config, data, [], {
            from: user,
          }),
          '0_HAaveProtocolV2_flashLoan: SafeERC20: low-level call failed'
        );
      } else {
        // FlashLoan with empty callback data
        const value = ether('1');
        const to = [this.hAaveV3.address];
        const config = [ZERO_BYTES32];

        // Prepare data
        const flashLoanData = web3.eth.abi.encodeParameters(
          ['address[]', 'bytes32[]', 'bytes[]'],
          [[], [], []]
        );
        const data = [
          getCallData(HAaveV3, 'flashLoan', [
            [wrappedTokenAddress],
            [value],
            [AAVE_RATEMODE.NODEBT],
            flashLoanData,
          ]),
        ];

        // Different error msg for Arbitrum
        if (chainId == 42161) {
          await expectRevert(
            this.proxy.batchExec(to, config, data, [], {
              from: user,
            }),
            '0_HAaveProtocolV3_flashLoan: ERC20: transfer amount exceeds balance'
          );
        } else {
          await expectRevert(
            this.proxy.batchExec(to, config, data, [], {
              from: user,
            }),
            '0_HAaveProtocolV3_flashLoan: Unspecified'
          );
        }
      }
    });

    it('0 -> 0 revert', async function() {
      if (chainId == 1) {
        // FlashLoan wrapped token -> withdraw revert
        const value = ether('1');
        const to = [this.hAaveV2.address];
        const config = [ZERO_BYTES32];

        // Prepare data
        const withdrawData = getCallData(HWrapper, 'withdraw', [
          value.mul(new BN('2')), // Excess withdraw
        ]);
        const flashLoanData = web3.eth.abi.encodeParameters(
          ['address[]', 'bytes32[]', 'bytes[]'],
          [[this.hWrapper.address], [ZERO_BYTES32], [withdrawData]]
        );
        const data = [
          getCallData(HAaveV2, 'flashLoan', [
            [wrappedTokenAddress],
            [value],
            [AAVE_RATEMODE.NODEBT],
            flashLoanData,
          ]),
        ];

        await expectRevert(
          this.proxy.batchExec(to, config, data, [], {
            from: user,
          }),
          '0_HAaveProtocolV2_flashLoan: 0_HWrappedNativeToken_withdraw: Unspecified'
        );
      } else {
        // FlashLoan wrapped token -> withdraw revert
        const value = ether('1');
        const to = [this.hAaveV3.address];
        const config = [ZERO_BYTES32];

        // Prepare data
        const withdrawData = getCallData(HWrapper, 'withdraw', [
          value.mul(new BN('2')), // Excess withdraw
        ]);
        const flashLoanData = web3.eth.abi.encodeParameters(
          ['address[]', 'bytes32[]', 'bytes[]'],
          [[this.hWrapper.address], [ZERO_BYTES32], [withdrawData]]
        );
        const data = [
          getCallData(HAaveV3, 'flashLoan', [
            [wrappedTokenAddress],
            [value],
            [AAVE_RATEMODE.NODEBT],
            flashLoanData,
          ]),
        ];

        // Different error msg for Arbitrum
        if (chainId == 42161) {
          await expectRevert(
            this.proxy.batchExec(to, config, data, [], {
              from: user,
            }),
            '0_HAaveProtocolV3_flashLoan: 0_HWrappedNativeToken_withdraw: ERC20: burn amount exceeds balance'
          );
        } else {
          await expectRevert(
            this.proxy.batchExec(to, config, data, [], {
              from: user,
            }),
            '0_HAaveProtocolV3_flashLoan: 0_HWrappedNativeToken_withdraw: Unspecified'
          );
        }
      }
    });

    it('0 -> 1 revert', async function() {
      if (chainId == 1) {
        // FlashLoan wrapped token -> withdraw -> deposit revert
        const value = ether('1');
        const to = [this.hAaveV2.address];
        const config = [ZERO_BYTES32];

        // Prepare data
        const withdrawData = getCallData(HWrapper, 'withdraw', [value]);
        const depositData = getCallData(HWrapper, 'deposit', [
          value.mul(new BN('2')), // Excess deposit
        ]);
        const flashLoanData = web3.eth.abi.encodeParameters(
          ['address[]', 'bytes32[]', 'bytes[]'],
          [
            [this.hWrapper.address, this.hWrapper.address],
            [ZERO_BYTES32, ZERO_BYTES32],
            [withdrawData, depositData],
          ]
        );
        const data = [
          getCallData(HAaveV2, 'flashLoan', [
            [wrappedTokenAddress],
            [value],
            [AAVE_RATEMODE.NODEBT],
            flashLoanData,
          ]),
        ];

        await expectRevert(
          this.proxy.batchExec(to, config, data, [], {
            from: user,
          }),
          '0_HAaveProtocolV2_flashLoan: 1_HWrappedNativeToken_deposit: Unspecified'
        );
      } else {
        // FlashLoan wrapped token -> withdraw -> deposit revert
        const value = ether('1');
        const to = [this.hAaveV3.address];
        const config = [ZERO_BYTES32];

        // Prepare data
        const withdrawData = getCallData(HWrapper, 'withdraw', [value]);
        const depositData = getCallData(HWrapper, 'deposit', [
          value.mul(new BN('2')), // Excess deposit
        ]);
        const flashLoanData = web3.eth.abi.encodeParameters(
          ['address[]', 'bytes32[]', 'bytes[]'],
          [
            [this.hWrapper.address, this.hWrapper.address],
            [ZERO_BYTES32, ZERO_BYTES32],
            [withdrawData, depositData],
          ]
        );
        const data = [
          getCallData(HAaveV3, 'flashLoan', [
            [wrappedTokenAddress],
            [value],
            [AAVE_RATEMODE.NODEBT],
            flashLoanData,
          ]),
        ];

        await expectRevert(
          this.proxy.batchExec(to, config, data, [], {
            from: user,
          }),
          '0_HAaveProtocolV3_flashLoan: 1_HWrappedNativeToken_deposit: Unspecified'
        );
      }
    });

    it('1 -> 0 revert', async function() {
      if (chainId == 1) {
        // Dummy deposit -> FlashLoan wrapped token -> withdraw revert
        const value = ether('1');
        const to = [this.hWrapper.address, this.hAaveV2.address];
        const config = [ZERO_BYTES32, ZERO_BYTES32];

        // Prepare data
        const withdrawData = getCallData(HWrapper, 'withdraw', [
          value.mul(new BN('2')), // Excess withdraw
        ]);
        const flashLoanData = web3.eth.abi.encodeParameters(
          ['address[]', 'bytes32[]', 'bytes[]'],
          [[this.hWrapper.address], [ZERO_BYTES32], [withdrawData]]
        );
        const data = [
          getCallData(HWrapper, 'deposit', [ether('0')]), // Dummy cube
          getCallData(HAaveV2, 'flashLoan', [
            [wrappedTokenAddress],
            [value],
            [AAVE_RATEMODE.NODEBT],
            flashLoanData,
          ]),
        ];

        await expectRevert(
          this.proxy.batchExec(to, config, data, [], {
            from: user,
          }),
          '1_HAaveProtocolV2_flashLoan: 0_HWrappedNativeToken_withdraw: Unspecified'
        );
      } else {
        // Dummy deposit -> FlashLoan wrapped token -> withdraw revert
        const value = ether('1');
        const to = [this.hWrapper.address, this.hAaveV3.address];
        const config = [ZERO_BYTES32, ZERO_BYTES32];

        // Prepare data
        const withdrawData = getCallData(HWrapper, 'withdraw', [
          value.mul(new BN('2')), // Excess withdraw
        ]);
        const flashLoanData = web3.eth.abi.encodeParameters(
          ['address[]', 'bytes32[]', 'bytes[]'],
          [[this.hWrapper.address], [ZERO_BYTES32], [withdrawData]]
        );
        const data = [
          getCallData(HWrapper, 'deposit', [ether('0')]), // Dummy cube
          getCallData(HAaveV3, 'flashLoan', [
            [wrappedTokenAddress],
            [value],
            [AAVE_RATEMODE.NODEBT],
            flashLoanData,
          ]),
        ];

        // Different error msg for Arbitrum
        if (chainId == 42161) {
          await expectRevert(
            this.proxy.batchExec(to, config, data, [], {
              from: user,
            }),
            '1_HAaveProtocolV3_flashLoan: 0_HWrappedNativeToken_withdraw: ERC20: burn amount exceeds balance'
          );
        } else {
          await expectRevert(
            this.proxy.batchExec(to, config, data, [], {
              from: user,
            }),
            '1_HAaveProtocolV3_flashLoan: 0_HWrappedNativeToken_withdraw: Unspecified'
          );
        }
      }
    });
  });

  describe('Existing handler', function() {
    if (chainId == 1) {
      it('0_0 revert', async function() {
        // Register existing wrapper
        const existingWrapper = '0x9e2Ba701cf5Dc47096060BB0a773e732BEE68dE6';

        await this.registry.register(
          existingWrapper,
          utils.asciiToHex('HWrapper')
        );

        const value = ether('1');
        const to = [existingWrapper];
        const config = [ZERO_BYTES32];
        const data = [getCallData(HWrapper, 'deposit', [value])];

        await expectRevert(
          this.proxy.batchExec(to, config, data, [], {
            from: user,
            value: 0, // Insufficient native token
          }),
          '0_0_HWeth_deposit: Unspecified'
        );
      });
    }
  });
});
