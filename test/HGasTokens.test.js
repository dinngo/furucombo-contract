const { balance, BN, constants, ether } = require('@openzeppelin/test-helpers');
const { ZERO_BYTES32 } = constants;
const { tracker } = balance;
const { expect } = require('chai');
const abi = require('ethereumjs-abi');
const utils = web3.utils;
const {
  CHI_TOKEN,
  GST2_TOKEN,
  MAKER_PROXY_REGISTRY,
  MAKER_MCD_VAT,
  MAKER_MCD_JOIN_ETH_A,
  MAKER_MCD_JOIN_DAI,
} = require('./utils/constants');
const { evmRevert, evmSnapshot, tokenProviderUniV2 } = require('./utils/utils');

const Registry = artifacts.require('Registry');
const Proxy = artifacts.require('ProxyMock');
const HGasTokens = artifacts.require('HGasTokens');
const IDSProxyRegistry = artifacts.require('IDSProxyRegistry');
const IToken = artifacts.require('IERC20');
const HMaker = artifacts.require('HMaker');
const IMakerVat = artifacts.require('IMakerVat');

async function getGenerateLimitAndMinCollateral(ilk) {
  const vat = await IMakerVat.at(MAKER_MCD_VAT);
  const conf = await vat.ilks.call(ilk);
  const generateLimit = conf[4].div(ether('1000000000'));
  const minCollateral = conf[4]
    .div(conf[2])
    .mul(new BN('12'))
    .div(new BN('10'));
  return [generateLimit, minCollateral];
}

contract('GasTokens', function([_, user1, user2]) {
  const token0Address = CHI_TOKEN;
  const token1Address = GST2_TOKEN;

  let id;
  let provider0Address;
  let provider1Address;

  before(async function() {
    provider0Address = await tokenProviderUniV2(token0Address);
    provider1Address = await tokenProviderUniV2(token1Address);

    this.dsRegistry = await IDSProxyRegistry.at(MAKER_PROXY_REGISTRY);
    this.registry = await Registry.new();
    this.proxy = await Proxy.new(this.registry.address);
    await this.dsRegistry.build(this.proxy.address);
    this.hGasTokens = await HGasTokens.new();
    await this.registry.register(
      this.hGasTokens.address,
      utils.asciiToHex('HGasTokens')
    );
    this.hMaker = await HMaker.new();
    await this.registry.register(
      this.hMaker.address,
      utils.asciiToHex('Maker')
    );
  });

  beforeEach(async function() {
    id = await evmSnapshot();
  });

  afterEach(async function() {
    await evmRevert(id);
  });

  describe('Free gas tokens', function() {
    it('CHI token', async function() {
      const token = await IToken.at(token0Address);
      const holdings = new BN('100');
      await token.transfer(user1, holdings, {
        from: provider0Address,
      });
      await token.approve(this.proxy.address, holdings, { from: user1 });
      await token.transfer(user2, holdings, {
        from: provider0Address,
      });
      await token.approve(this.proxy.address, holdings, { from: user2 });
      // Create a combo including gas token cube and 1 dummy maker cube

      // Firstly get gas cost when consume 0 gas token
      const ilkEth = utils.padRight(utils.asciiToHex('ETH-A'), 64);
      const [
        generateLimit,
        minCollateral,
      ] = await getGenerateLimitAndMinCollateral(ilkEth);
      const wadD = generateLimit;
      const value = minCollateral;
      const config = [ZERO_BYTES32, ZERO_BYTES32];
      const to = [this.hGasTokens.address, this.hMaker.address];
      let amount = 0;
      let data = [
        abi.simpleEncode('freeCHI(uint256)', amount),
        abi.simpleEncode(
          'openLockETHAndDraw(uint256,address,address,bytes32,uint256)',
          value,
          MAKER_MCD_JOIN_ETH_A,
          MAKER_MCD_JOIN_DAI,
          ilkEth,
          wadD
        ),
      ];
      const balanceUser1 = await tracker(user1);
      const receiptBefore = await this.proxy.batchExec(to, config, data, {
        from: user1,
        value: value,
      });
      const gasUsedBefore = new BN(receiptBefore.receipt.gasUsed);
      expect(await balanceUser1.delta()).to.be.bignumber.eq(
        ether('0')
          .sub(value)
          .sub(gasUsedBefore)
      );

      // Secondly get gas cost when consume 20 gas tokens
      amount = new BN('20');
      data = [
        abi.simpleEncode('freeCHI(uint256)', amount),
        abi.simpleEncode(
          'openLockETHAndDraw(uint256,address,address,bytes32,uint256)',
          value,
          MAKER_MCD_JOIN_ETH_A,
          MAKER_MCD_JOIN_DAI,
          ilkEth,
          wadD
        ),
      ];
      const balanceUser2 = await tracker(user2);
      const tokenBalanceBefore = await token.balanceOf.call(user2);
      const receipt = await this.proxy.batchExec(to, config, data, {
        from: user2,
        value: value,
      });
      const gasUsed = new BN(receipt.receipt.gasUsed);
      // Check proxy token balance
      expect(await token.balanceOf.call(this.proxy.address)).to.be.zero;

      // Check user eth balance
      expect(await balanceUser2.delta()).to.be.bignumber.eq(
        ether('0')
          .sub(value)
          .sub(gasUsed)
      );

      // Check gas usage with gas token should be smaller
      expect(gasUsed).to.be.bignumber.lte(gasUsedBefore);

      // Check user gas token consumption should not exceed amount
      expect(await token.balanceOf.call(user2)).to.be.bignumber.gte(
        tokenBalanceBefore.sub(amount)
      );
    });

    it('GST2 token', async function() {
      const token = await IToken.at(token1Address);
      const holdings = new BN('100');
      await token.transfer(user1, holdings, {
        from: provider1Address,
      });
      await token.approve(this.proxy.address, holdings, { from: user1 });
      await token.transfer(user2, holdings, {
        from: provider1Address,
      });
      await token.approve(this.proxy.address, holdings, { from: user2 });
      // Create a combo including gas token cube and 1 dummy maker cube

      // Firstly get gas cost when consume 0 gas token
      const ilkEth = utils.padRight(utils.asciiToHex('ETH-A'), 64);
      const [
        generateLimit,
        minCollateral,
      ] = await getGenerateLimitAndMinCollateral(ilkEth);
      const wadD = generateLimit;
      const value = minCollateral;
      const config = [ZERO_BYTES32, ZERO_BYTES32];
      const to = [this.hGasTokens.address, this.hMaker.address];
      let amount = 0;
      let data = [
        abi.simpleEncode('freeGST2(uint256)', amount),
        abi.simpleEncode(
          'openLockETHAndDraw(uint256,address,address,bytes32,uint256)',
          value,
          MAKER_MCD_JOIN_ETH_A,
          MAKER_MCD_JOIN_DAI,
          ilkEth,
          wadD
        ),
      ];
      const balanceUser1 = await tracker(user1);
      const receiptBefore = await this.proxy.batchExec(to, config, data, {
        from: user1,
        value: value,
      });
      const gasUsedBefore = new BN(receiptBefore.receipt.gasUsed);
      expect(await balanceUser1.delta()).to.be.bignumber.eq(
        ether('0')
          .sub(value)
          .sub(gasUsedBefore)
      );

      // Secondly get gas cost when consume 20 gas tokens
      amount = new BN('20');
      data = [
        abi.simpleEncode('freeGST2(uint256)', amount),
        abi.simpleEncode(
          'openLockETHAndDraw(uint256,address,address,bytes32,uint256)',
          value,
          MAKER_MCD_JOIN_ETH_A,
          MAKER_MCD_JOIN_DAI,
          ilkEth,
          wadD
        ),
      ];
      const balanceUser2 = await tracker(user2);
      const tokenBalanceBefore = await token.balanceOf.call(user2);
      const receipt = await this.proxy.batchExec(to, config, data, {
        from: user2,
        value: value,
      });
      const gasUsed = new BN(receipt.receipt.gasUsed);
      // Check proxy token balance
      expect(await token.balanceOf.call(this.proxy.address)).to.be.zero;

      // Check user eth balance
      expect(await balanceUser2.delta()).to.be.bignumber.eq(
        ether('0')
          .sub(value)
          .sub(gasUsed)
      );

      // Check gas usage with gas token should be smaller
      expect(gasUsed).to.be.bignumber.lte(gasUsedBefore);

      // Check user gas token consumption should not exceed amount
      expect(await token.balanceOf.call(user2)).to.be.bignumber.gte(
        tokenBalanceBefore.sub(amount)
      );
    });
  });
});
