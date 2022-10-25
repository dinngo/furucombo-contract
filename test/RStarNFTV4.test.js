const chainId = network.config.chainId;

if (chainId == 1 || chainId == 42161 || chainId == 10) {
  // This test supports to run on these chains.
} else {
  return;
}

const { BN, constants, ether } = require('@openzeppelin/test-helpers');
const { ZERO_ADDRESS } = constants;
const abi = require('ethereumjs-abi');
const utils = web3.utils;

const { expect } = require('chai');
const { STAR_NFTV4 } = require('./utils/constants');

const {
  evmRevert,
  evmSnapshot,
  impersonateAndInjectEther,
} = require('./utils/utils');

const FeeRuleRegistry = artifacts.require('FeeRuleRegistry');
const RStarNFTV4 = artifacts.require('RStarNFTV4');
const IStarNFTV4 = artifacts.require('IStarNFTV4');

const CID = 1000; // Pick a random number
const BASE = ether('1');
const BASIS_FEE_RATE = ether('0.002'); // 0.2%
const STAR_NFTV4_DISCOUNTA = ether('0.8'); // 80%
const STAR_NFTV4_DISCOUNTB = ether('0.5'); // 50%
const STAR_NFTV4_DISCOUNTC = ether('0.15'); // 15%
const STAR_NFTV4_DISCOUNT_ZERO = ether('0'); // 0%

contract('RStarNFTV4', function([_, feeCollector, user, someone]) {
  let id;

  before(async function() {
    this.starNFT = await IStarNFTV4.at(STAR_NFTV4);
    this.registry = await FeeRuleRegistry.new(BASIS_FEE_RATE, feeCollector);
    this.starNFTRuleA = await RStarNFTV4.new(STAR_NFTV4, STAR_NFTV4_DISCOUNTA);
    this.starNFTRuleB = await RStarNFTV4.new(STAR_NFTV4, STAR_NFTV4_DISCOUNTB);
    this.starNFTRuleC = await RStarNFTV4.new(STAR_NFTV4, STAR_NFTV4_DISCOUNTC);
    this.starNFTRuleZero = await RStarNFTV4.new(
      STAR_NFTV4,
      STAR_NFTV4_DISCOUNT_ZERO
    );

    // Lock free pass nfts owner
    const starNFTOwner = await this.starNFT.owner();
    impersonateAndInjectEther(await this.starNFT.owner());

    // Add minter
    await this.starNFT.addMinter(starNFTOwner, {
      from: starNFTOwner,
    });

    // Mint nft to user
    this.starNFTTokenID = (await this.starNFT.getNumMinted()).add(new BN(1));

    await this.starNFT.mint(user, CID, {
      from: starNFTOwner,
    });

    expect(await this.starNFT.balanceOf(user)).to.be.bignumber.gte(new BN(1));
    expect(await this.starNFT.balanceOf(someone)).to.be.bignumber.zero;
  });

  beforeEach(async function() {
    id = await evmSnapshot();
  });

  afterEach(async function() {
    await evmRevert(id);
  });

  describe('StarNFTV4', function() {
    describe('calculate single', function() {
      describe('low discount', function() {
        beforeEach(async function() {
          await this.registry.registerRule(this.starNFTRuleA.address);
          expect(await this.registry.rules.call('0')).to.be.eq(
            this.starNFTRuleA.address
          );
        });

        it('qualified without basis', async function() {
          const queryAddr = user;
          const rate = await this.registry.calFeeRateWithoutBasis.call(
            queryAddr,
            '0'
          );
          expect(rate).to.be.bignumber.eq(STAR_NFTV4_DISCOUNTA);
        });

        it('qualified with basis', async function() {
          const queryAddr = user;
          const rate = await this.registry.calFeeRate.call(queryAddr, '0');
          expect(rate).to.be.bignumber.eq(
            STAR_NFTV4_DISCOUNTA.mul(BASIS_FEE_RATE).div(BASE)
          );
        });

        it('not qualified without basis', async function() {
          const queryAddr = someone;
          const rate = await this.registry.calFeeRateWithoutBasis.call(
            queryAddr,
            '0'
          );
          expect(rate).to.be.bignumber.eq(BASE);
        });

        it('not qualified with basis', async function() {
          const queryAddr = someone;
          const rate = await this.registry.calFeeRate.call(queryAddr, '0');
          expect(rate).to.be.bignumber.eq(BASIS_FEE_RATE);
        });
      });

      describe('middle discount', function() {
        beforeEach(async function() {
          const receipt = await this.registry.registerRule(
            this.starNFTRuleB.address
          );
          expect(await this.registry.rules.call('0')).to.be.eq(
            this.starNFTRuleB.address
          );
        });

        it('qualified without basis', async function() {
          const queryAddr = user;
          const rate = await this.registry.calFeeRateWithoutBasis.call(
            queryAddr,
            '0'
          );
          expect(rate).to.be.bignumber.eq(STAR_NFTV4_DISCOUNTB);
        });

        it('qualified with basis', async function() {
          const queryAddr = user;
          const rate = await this.registry.calFeeRate.call(queryAddr, '0');
          expect(rate).to.be.bignumber.eq(
            STAR_NFTV4_DISCOUNTB.mul(BASIS_FEE_RATE).div(BASE)
          );
        });

        it('not qualified without basis', async function() {
          const queryAddr = someone;
          const rate = await this.registry.calFeeRateWithoutBasis.call(
            queryAddr,
            '0'
          );
          expect(rate).to.be.bignumber.eq(BASE);
        });

        it('not qualified with basis', async function() {
          const queryAddr = someone;
          const rate = await this.registry.calFeeRate.call(queryAddr, '0');
          expect(rate).to.be.bignumber.eq(BASIS_FEE_RATE);
        });
      });

      describe('high discount', function() {
        beforeEach(async function() {
          const receipt = await this.registry.registerRule(
            this.starNFTRuleC.address
          );
          expect(await this.registry.rules.call('0')).to.be.eq(
            this.starNFTRuleC.address
          );
        });

        it('qualified without basis', async function() {
          const queryAddr = user;
          const rate = await this.registry.calFeeRateWithoutBasis.call(
            queryAddr,
            '0'
          );
          expect(rate).to.be.bignumber.eq(STAR_NFTV4_DISCOUNTC);
        });

        it('qualified with basis', async function() {
          const queryAddr = user;
          const rate = await this.registry.calFeeRate.call(queryAddr, '0');
          expect(rate).to.be.bignumber.eq(
            STAR_NFTV4_DISCOUNTC.mul(BASIS_FEE_RATE).div(BASE)
          );
        });

        it('not qualified without basis', async function() {
          const queryAddr = someone;
          const rate = await this.registry.calFeeRateWithoutBasis.call(
            queryAddr,
            '0'
          );
          expect(rate).to.be.bignumber.eq(BASE);
        });

        it('not qualified with basis', async function() {
          const queryAddr = someone;
          const rate = await this.registry.calFeeRate.call(queryAddr, '0');
          expect(rate).to.be.bignumber.eq(BASIS_FEE_RATE);
        });
      });

      describe('zero discount', function() {
        beforeEach(async function() {
          const receipt = await this.registry.registerRule(
            this.starNFTRuleZero.address
          );
          expect(await this.registry.rules.call('0')).to.be.eq(
            this.starNFTRuleZero.address
          );
        });

        it('qualified without basis', async function() {
          const queryAddr = user;
          const rate = await this.registry.calFeeRateWithoutBasis.call(
            queryAddr,
            '0'
          );
          expect(rate).to.be.bignumber.zero;
        });

        it('qualified with basis', async function() {
          const queryAddr = user;
          const rate = await this.registry.calFeeRate.call(queryAddr, '0');
          expect(rate).to.be.bignumber.zero;
        });

        it('not qualified without basis', async function() {
          const queryAddr = someone;
          const rate = await this.registry.calFeeRateWithoutBasis.call(
            queryAddr,
            '0'
          );
          expect(rate).to.be.bignumber.eq(BASE);
        });

        it('not qualified with basis', async function() {
          const queryAddr = someone;
          const rate = await this.registry.calFeeRate.call(queryAddr, '0');
          expect(rate).to.be.bignumber.eq(BASIS_FEE_RATE);
        });
      });
    });

    describe('calculate multi', function() {
      beforeEach(async function() {
        // register rules
        await this.registry.registerRule(this.starNFTRuleA.address);
        expect(await this.registry.rules.call('0')).to.be.eq(
          this.starNFTRuleA.address
        );
        await this.registry.registerRule(this.starNFTRuleB.address);
        expect(await this.registry.rules.call('1')).to.be.eq(
          this.starNFTRuleB.address
        );

        await this.registry.registerRule(this.starNFTRuleC.address);
        expect(await this.registry.rules.call('2')).to.be.eq(
          this.starNFTRuleC.address
        );
      });

      it('multiple indexes: qualified for all without basis', async function() {
        const queryAddr = user;
        const indexes = ['0', '1', '2'];
        const rate = await this.registry.calFeeRateMultiWithoutBasis.call(
          queryAddr,
          indexes
        );
        expect(rate).to.be.bignumber.eq(
          STAR_NFTV4_DISCOUNTA.mul(STAR_NFTV4_DISCOUNTB)
            .mul(STAR_NFTV4_DISCOUNTC)
            .div(BASE)
            .div(BASE)
        );
      });

      it('multiple indexes: qualified for all with basis', async function() {
        const queryAddr = user;
        const indexes = ['0', '1', '2'];
        const rate = await this.registry.calFeeRateMulti.call(
          queryAddr,
          indexes
        );
        expect(rate).to.be.bignumber.eq(
          STAR_NFTV4_DISCOUNTA.mul(STAR_NFTV4_DISCOUNTB)
            .mul(STAR_NFTV4_DISCOUNTC)
            .mul(BASIS_FEE_RATE)
            .div(BASE)
            .div(BASE)
            .div(BASE)
        );
      });

      it('multiple indexes: qualified for both of all without basis', async function() {
        const queryAddr = user;
        const indexes = ['0', '1'];
        const rate = await this.registry.calFeeRateMultiWithoutBasis.call(
          queryAddr,
          indexes
        );
        expect(rate).to.be.bignumber.eq(
          STAR_NFTV4_DISCOUNTA.mul(STAR_NFTV4_DISCOUNTB).div(BASE)
        );
      });

      it('multiple indexes: qualified for both with basis', async function() {
        const queryAddr = user;
        const indexes = ['0', '1'];
        const rate = await this.registry.calFeeRateMulti.call(
          queryAddr,
          indexes
        );
        expect(rate).to.be.bignumber.eq(
          STAR_NFTV4_DISCOUNTA.mul(STAR_NFTV4_DISCOUNTB)
            .mul(BASIS_FEE_RATE)
            .div(BASE)
            .div(BASE)
        );
      });

      it('multiple indexes: not qualified without basis', async function() {
        const queryAddr = someone;
        const indexes = ['0', '1', '2'];
        const rate = await this.registry.calFeeRateMultiWithoutBasis.call(
          queryAddr,
          indexes
        );
        expect(rate).to.be.bignumber.eq(BASE);
      });

      it('multiple indexes: not qualified with basis', async function() {
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
