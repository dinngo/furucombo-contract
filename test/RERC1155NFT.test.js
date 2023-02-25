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

const { BN, constants, ether } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');
const { evmRevert, evmSnapshot } = require('./utils/utils');

const FeeRuleRegistry = artifacts.require('FeeRuleRegistry');
const RERC1155NFT = artifacts.require('RERC1155NFT');
const ERC1155Mock = artifacts.require('ERC1155Mock');

const BASE = ether('1');
const BASIS_FEE_RATE = ether('0.002'); // 0.2%
const NFT_DISCOUNTA = ether('0.8'); // 80%
const NFT_DISCOUNTB = ether('0.5'); // 50%
const NFT_DISCOUNTC = ether('0.15'); // 15%
const NFT_DISCOUNT_ZERO = ether('0'); // 0%

contract('RERC1155NFT', function ([owner, feeCollector, user, someone]) {
  let id;

  before(async function () {
    this.nft = await ERC1155Mock.new();
    this.nftTokenID = await this.nft.tokenId();
    this.registry = await FeeRuleRegistry.new(BASIS_FEE_RATE, feeCollector);
    this.nftRuleA = await RERC1155NFT.new(
      this.nft.address,
      NFT_DISCOUNTA,
      this.nftTokenID
    );
    this.nftRuleB = await RERC1155NFT.new(
      this.nft.address,
      NFT_DISCOUNTB,
      this.nftTokenID
    );
    this.nftRuleC = await RERC1155NFT.new(
      this.nft.address,
      NFT_DISCOUNTC,
      this.nftTokenID
    );
    this.nftRuleZero = await RERC1155NFT.new(
      this.nft.address,
      NFT_DISCOUNT_ZERO,
      this.nftTokenID
    );

    // Transfer  nft to user
    await this.nft.safeTransferFrom(owner, user, this.nftTokenID, 1, '0x', {
      from: owner,
    });

    expect(await this.nft.balanceOf(user, this.nftTokenID)).to.be.bignumber.gte(
      new BN(1)
    );
    expect(
      await this.nft.balanceOf(someone, this.nftTokenID)
    ).to.be.bignumber.zero;
  });

  beforeEach(async function () {
    id = await evmSnapshot();
  });

  afterEach(async function () {
    await evmRevert(id);
  });

  describe('RERC1155NFT', function () {
    describe('calculate single', function () {
      //  The fee is higher if the Rule discount is higher. The fee is lower if the Rule discount is lower.
      describe('high rule discount', function () {
        beforeEach(async function () {
          await this.registry.registerRule(this.nftRuleA.address);
          expect(await this.registry.rules.call('0')).to.be.eq(
            this.nftRuleA.address
          );
        });

        it('qualified without basis', async function () {
          const queryAddr = user;
          const rate = await this.registry.calFeeRateWithoutBasis.call(
            queryAddr,
            '0'
          );
          expect(rate).to.be.bignumber.eq(NFT_DISCOUNTA);
        });

        it('qualified with basis', async function () {
          const queryAddr = user;
          const rate = await this.registry.calFeeRate.call(queryAddr, '0');
          expect(rate).to.be.bignumber.eq(
            NFT_DISCOUNTA.mul(BASIS_FEE_RATE).div(BASE)
          );
        });

        it('not qualified without basis', async function () {
          const queryAddr = someone;
          const rate = await this.registry.calFeeRateWithoutBasis.call(
            queryAddr,
            '0'
          );
          expect(rate).to.be.bignumber.eq(BASE);
        });

        it('not qualified with basis', async function () {
          const queryAddr = someone;
          const rate = await this.registry.calFeeRate.call(queryAddr, '0');
          expect(rate).to.be.bignumber.eq(BASIS_FEE_RATE);
        });
      });

      describe('middle rule discount', function () {
        beforeEach(async function () {
          const receipt = await this.registry.registerRule(
            this.nftRuleB.address
          );
          expect(await this.registry.rules.call('0')).to.be.eq(
            this.nftRuleB.address
          );
        });

        it('qualified without basis', async function () {
          const queryAddr = user;
          const rate = await this.registry.calFeeRateWithoutBasis.call(
            queryAddr,
            '0'
          );
          expect(rate).to.be.bignumber.eq(NFT_DISCOUNTB);
        });

        it('qualified with basis', async function () {
          const queryAddr = user;
          const rate = await this.registry.calFeeRate.call(queryAddr, '0');
          expect(rate).to.be.bignumber.eq(
            NFT_DISCOUNTB.mul(BASIS_FEE_RATE).div(BASE)
          );
        });

        it('not qualified without basis', async function () {
          const queryAddr = someone;
          const rate = await this.registry.calFeeRateWithoutBasis.call(
            queryAddr,
            '0'
          );
          expect(rate).to.be.bignumber.eq(BASE);
        });

        it('not qualified with basis', async function () {
          const queryAddr = someone;
          const rate = await this.registry.calFeeRate.call(queryAddr, '0');
          expect(rate).to.be.bignumber.eq(BASIS_FEE_RATE);
        });
      });

      describe('low rule discount', function () {
        beforeEach(async function () {
          const receipt = await this.registry.registerRule(
            this.nftRuleC.address
          );
          expect(await this.registry.rules.call('0')).to.be.eq(
            this.nftRuleC.address
          );
        });

        it('qualified without basis', async function () {
          const queryAddr = user;
          const rate = await this.registry.calFeeRateWithoutBasis.call(
            queryAddr,
            '0'
          );
          expect(rate).to.be.bignumber.eq(NFT_DISCOUNTC);
        });

        it('qualified with basis', async function () {
          const queryAddr = user;
          const rate = await this.registry.calFeeRate.call(queryAddr, '0');
          expect(rate).to.be.bignumber.eq(
            NFT_DISCOUNTC.mul(BASIS_FEE_RATE).div(BASE)
          );
        });

        it('not qualified without basis', async function () {
          const queryAddr = someone;
          const rate = await this.registry.calFeeRateWithoutBasis.call(
            queryAddr,
            '0'
          );
          expect(rate).to.be.bignumber.eq(BASE);
        });

        it('not qualified with basis', async function () {
          const queryAddr = someone;
          const rate = await this.registry.calFeeRate.call(queryAddr, '0');
          expect(rate).to.be.bignumber.eq(BASIS_FEE_RATE);
        });
      });

      describe('zero rule discount', function () {
        beforeEach(async function () {
          const receipt = await this.registry.registerRule(
            this.nftRuleZero.address
          );
          expect(await this.registry.rules.call('0')).to.be.eq(
            this.nftRuleZero.address
          );
        });

        it('qualified without basis', async function () {
          const queryAddr = user;
          const rate = await this.registry.calFeeRateWithoutBasis.call(
            queryAddr,
            '0'
          );
          expect(rate).to.be.bignumber.zero;
        });

        it('qualified with basis', async function () {
          const queryAddr = user;
          const rate = await this.registry.calFeeRate.call(queryAddr, '0');
          expect(rate).to.be.bignumber.zero;
        });

        it('not qualified without basis', async function () {
          const queryAddr = someone;
          const rate = await this.registry.calFeeRateWithoutBasis.call(
            queryAddr,
            '0'
          );
          expect(rate).to.be.bignumber.eq(BASE);
        });

        it('not qualified with basis', async function () {
          const queryAddr = someone;
          const rate = await this.registry.calFeeRate.call(queryAddr, '0');
          expect(rate).to.be.bignumber.eq(BASIS_FEE_RATE);
        });
      });
    });

    describe('calculate multi', function () {
      beforeEach(async function () {
        // register rules
        await this.registry.registerRule(this.nftRuleA.address);
        expect(await this.registry.rules.call('0')).to.be.eq(
          this.nftRuleA.address
        );
        await this.registry.registerRule(this.nftRuleB.address);
        expect(await this.registry.rules.call('1')).to.be.eq(
          this.nftRuleB.address
        );

        await this.registry.registerRule(this.nftRuleC.address);
        expect(await this.registry.rules.call('2')).to.be.eq(
          this.nftRuleC.address
        );
      });

      it('multiple indexes: qualified for all without basis', async function () {
        const queryAddr = user;
        const indexes = ['0', '1', '2'];
        const rate = await this.registry.calFeeRateMultiWithoutBasis.call(
          queryAddr,
          indexes
        );
        expect(rate).to.be.bignumber.eq(
          NFT_DISCOUNTA.mul(NFT_DISCOUNTB)
            .mul(NFT_DISCOUNTC)
            .div(BASE)
            .div(BASE)
        );
      });

      it('multiple indexes: qualified for all with basis', async function () {
        const queryAddr = user;
        const indexes = ['0', '1', '2'];
        const rate = await this.registry.calFeeRateMulti.call(
          queryAddr,
          indexes
        );
        expect(rate).to.be.bignumber.eq(
          NFT_DISCOUNTA.mul(NFT_DISCOUNTB)
            .mul(NFT_DISCOUNTC)
            .mul(BASIS_FEE_RATE)
            .div(BASE)
            .div(BASE)
            .div(BASE)
        );
      });

      it('multiple indexes: qualified for both of all without basis', async function () {
        const queryAddr = user;
        const indexes = ['0', '1'];
        const rate = await this.registry.calFeeRateMultiWithoutBasis.call(
          queryAddr,
          indexes
        );
        expect(rate).to.be.bignumber.eq(
          NFT_DISCOUNTA.mul(NFT_DISCOUNTB).div(BASE)
        );
      });

      it('multiple indexes: qualified for both with basis', async function () {
        const queryAddr = user;
        const indexes = ['0', '1'];
        const rate = await this.registry.calFeeRateMulti.call(
          queryAddr,
          indexes
        );
        expect(rate).to.be.bignumber.eq(
          NFT_DISCOUNTA.mul(NFT_DISCOUNTB)
            .mul(BASIS_FEE_RATE)
            .div(BASE)
            .div(BASE)
        );
      });

      it('multiple indexes: not qualified without basis', async function () {
        const queryAddr = someone;
        const indexes = ['0', '1', '2'];
        const rate = await this.registry.calFeeRateMultiWithoutBasis.call(
          queryAddr,
          indexes
        );
        expect(rate).to.be.bignumber.eq(BASE);
      });

      it('multiple indexes: not qualified with basis', async function () {
        const queryAddr = someone;
        const indexes = ['0', '1', '2'];
        const rate = await this.registry.calFeeRateMulti.call(
          queryAddr,
          indexes
        );
        expect(rate).to.be.bignumber.eq(BASIS_FEE_RATE);
      });
    });
  });
});
