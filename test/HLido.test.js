const chainId = network.config.chainId;
if (chainId == 1) {
  // This test supports to run on these chains.
} else {
  return;
}

const { balance, BN, constants, ether } = require('@openzeppelin/test-helpers');
const { MAX_UINT256 } = constants;
const { tracker } = balance;
const abi = require('ethereumjs-abi');
const utils = web3.utils;
const { expect } = require('chai');

const {
  STETH_TOKEN,
  LIDO_PROXY,
  LIDO_REFERRAL_ADDRESS,
} = require('./utils/constants');

const {
  evmRevert,
  evmSnapshot,
  profileGas,
  getHandlerReturn,
} = require('./utils/utils');

const HLido = artifacts.require('HLido');
const FeeRuleRegistry = artifacts.require('FeeRuleRegistry');
const Registry = artifacts.require('Registry');
const Proxy = artifacts.require('ProxyMock');
const IToken = artifacts.require('IERC20');
const ILido = artifacts.require('ILido');

contract('Lido', function ([_, user]) {
  const tokenAddress = STETH_TOKEN;

  let id;
  let balanceUser;
  let balanceProxy;

  before(async function () {
    this.registry = await Registry.new();
    this.feeRuleRegistry = await FeeRuleRegistry.new('0', _);
    this.proxy = await Proxy.new(
      this.registry.address,
      this.feeRuleRegistry.address
    );
    this.hLido = await HLido.new(LIDO_PROXY, LIDO_REFERRAL_ADDRESS);
    await this.registry.register(this.hLido.address, utils.asciiToHex('Lido'));
    this.stToken = await IToken.at(tokenAddress);
    this.lido = await ILido.at(LIDO_PROXY);
  });

  beforeEach(async function () {
    id = await evmSnapshot();
    balanceUser = await tracker(user);
    balanceProxy = await tracker(this.proxy.address);
  });

  afterEach(async function () {
    await evmRevert(id);
  });

  describe('Submit', function () {
    it('normal', async function () {
      const value = ether('10');
      const to = this.hLido.address;
      const data = abi.simpleEncode('submit(uint256)', value);

      // Get expected value
      const expectedShareAmount = await this.lido.submit.call(
        LIDO_REFERRAL_ADDRESS,
        {
          from: user,
          value: value,
        }
      );
      const expectedStTokenAmount = await this.lido.getPooledEthByShares.call(
        expectedShareAmount
      );

      // Execute
      const tokenBefore = await this.stToken.balanceOf.call(user);
      const receipt = await this.proxy.execMock(to, data, {
        from: user,
        value: value,
      });

      // Verify
      const handlerReturn = utils.toBN(
        getHandlerReturn(receipt, ['uint256'])[0]
      );
      expect(await balanceProxy.get()).to.be.bignumber.zero;

      // As the stToken's balanceOf() function is calculated based on shares, there may be calculation errors that
      // leave dust in the proxy and cannot be returned to the user. Give 2 wei tolerance for this.
      expect(
        await this.stToken.balanceOf.call(this.proxy.address)
      ).to.be.bignumber.lte(new BN(1));
      expect(await this.stToken.balanceOf.call(user)).to.be.bignumber.gte(
        tokenBefore.add(expectedStTokenAmount).sub(new BN(2))
      );
      expect(handlerReturn).to.be.bignumber.eq(expectedStTokenAmount);

      expect(await balanceUser.delta()).to.be.bignumber.eq(
        ether('0').sub(value)
      );
      profileGas(receipt);
    });

    it('max amount', async function () {
      const value = ether('10');
      const to = this.hLido.address;
      const data = abi.simpleEncode('submit(uint256)', MAX_UINT256);

      // Get expected value
      const expectedShareAmount = await this.lido.submit.call(
        LIDO_REFERRAL_ADDRESS,
        {
          from: user,
          value: value,
        }
      );
      const expectedStTokenAmount = await this.lido.getPooledEthByShares.call(
        expectedShareAmount
      );

      // Execute
      const tokenBefore = await this.stToken.balanceOf.call(user);
      const receipt = await this.proxy.execMock(to, data, {
        from: user,
        value: value,
      });

      // Verify
      const handlerReturn = utils.toBN(
        getHandlerReturn(receipt, ['uint256'])[0]
      );
      expect(await balanceProxy.get()).to.be.bignumber.zero;

      // As the stToken's balanceOf() function is calculated based on shares, there may be calculation errors that
      // leave dust in the proxy and cannot be returned to the user. Give 2 wei tolerance for this.
      expect(
        await this.stToken.balanceOf.call(this.proxy.address)
      ).to.be.bignumber.lte(new BN(1));

      expect(await this.stToken.balanceOf.call(user)).to.be.bignumber.gte(
        tokenBefore.add(expectedStTokenAmount).sub(new BN(2))
      );
      expect(handlerReturn).to.be.bignumber.eq(expectedStTokenAmount);

      expect(await balanceUser.delta()).to.be.bignumber.eq(
        ether('0').sub(value)
      );
      profileGas(receipt);
    });
  });
});
