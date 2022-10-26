const chainId = network.config.chainId;

if (chainId == 1 || chainId == 10 || chainId == 42161) {
  // This test supports to run on these chains.
} else {
  return;
}

const { BN, ether } = require('@openzeppelin/test-helpers');

const { expect } = require('chai');

const {
  evmRevert,
  evmSnapshot,
  impersonateAndInjectEther,
} = require('./utils/utils');

const FeeRuleRegistry = artifacts.require('FeeRuleRegistry');
const RCubeNFT = artifacts.require('RCubeNFT');
const IStarNFTV4 = artifacts.require('IStarNFTV4');

const CID = 1000; // Pick a random number
const BASE = ether('1');
const BASIS_FEE_RATE = ether('0.002'); // 0.2%
const WOODEN_DISCOUNT = ether('0.95'); // 95%
const METAL_DISCOUNT = ether('0.9'); // 90%
const DIAMOND_DISCOUNT = ether('0.8'); // 80%
const FREE_PASS_DISCOUNT = ether('0'); // 0%

contract('RCubeNFT', function([_, feeCollector, user, someone]) {
  let id;

  before(async function() {
    if (chainId == 1) {
      const {
        WOODEN_CUBE,
        METAL_CUBE,
        DIAMOND_CUBE,
      } = require('./utils/constants');
      this.wooden = await IStarNFTV4.at(WOODEN_CUBE);
      this.metal = await IStarNFTV4.at(METAL_CUBE);
      this.diamond = await IStarNFTV4.at(DIAMOND_CUBE);

      this.registry = await FeeRuleRegistry.new(BASIS_FEE_RATE, feeCollector);
      this.woodenRule = await RCubeNFT.new(WOODEN_CUBE, WOODEN_DISCOUNT);
      this.metalRule = await RCubeNFT.new(METAL_CUBE, METAL_DISCOUNT);
      this.diamondRule = await RCubeNFT.new(DIAMOND_CUBE, DIAMOND_DISCOUNT);

      // Lock cube nfts owner
      const woodenOwner = await this.wooden.owner();
      const metalOwner = await this.metal.owner();
      const diamondOwner = await this.diamond.owner();
      impersonateAndInjectEther(await this.wooden.owner());
      impersonateAndInjectEther(await this.metal.owner());
      impersonateAndInjectEther(await this.diamond.owner());

      // Add minter
      await this.wooden.addMinter(woodenOwner, {
        from: woodenOwner,
      });
      await this.metal.addMinter(woodenOwner, {
        from: metalOwner,
      });
      await this.diamond.addMinter(woodenOwner, {
        from: diamondOwner,
      });

      // Mint nft to user
      this.woodenTokenID = (await this.wooden.getNumMinted()).add(new BN(1));
      this.metalTokenID = (await this.metal.getNumMinted()).add(new BN(1));
      this.diamondTokenID = (await this.diamond.getNumMinted()).add(new BN(1));
      await this.wooden.mint(user, CID, {
        from: woodenOwner,
      });
      await this.metal.mint(user, CID, {
        from: metalOwner,
      });
      await this.diamond.mint(user, CID, {
        from: diamondOwner,
      });
      expect(await this.wooden.balanceOf(user)).to.be.bignumber.gte(new BN(1));
      expect(await this.metal.balanceOf(user)).to.be.bignumber.gte(new BN(1));
      expect(await this.diamond.balanceOf(user)).to.be.bignumber.gte(new BN(1));
      expect(await this.wooden.balanceOf(someone)).to.be.bignumber.zero;
      expect(await this.metal.balanceOf(someone)).to.be.bignumber.zero;
      expect(await this.diamond.balanceOf(someone)).to.be.bignumber.zero;
    } else if (chainId == 10 || chainId == 42161) {
      const { FREE_PASS } = require('./utils/constants');
      this.freePass = await IStarNFTV4.at(FREE_PASS);
      this.registry = await FeeRuleRegistry.new(BASIS_FEE_RATE, feeCollector);
      this.freePassRule = await RCubeNFT.new(FREE_PASS, FREE_PASS_DISCOUNT);

      // Lock free pass nfts owner
      const freePassOwner = await this.freePass.owner();
      impersonateAndInjectEther(await this.freePass.owner());

      // Add minter
      await this.freePass.addMinter(freePassOwner, {
        from: freePassOwner,
      });

      // Mint nft to user
      this.freePassTokenID = (await this.freePass.getNumMinted()).add(
        new BN(1)
      );

      await this.freePass.mint(user, CID, {
        from: freePassOwner,
      });

      expect(await this.freePass.balanceOf(user)).to.be.bignumber.gte(
        new BN(1)
      );
      expect(await this.freePass.balanceOf(someone)).to.be.bignumber.zero;
    }
  });

  beforeEach(async function() {
    id = await evmSnapshot();
  });

  afterEach(async function() {
    await evmRevert(id);
  });

  describe('Cube NFT', function() {
    if (chainId == 1) {
      describe('calculate single', function() {
        describe('Wooden Cube', function() {
          beforeEach(async function() {
            await this.registry.registerRule(this.woodenRule.address);
            expect(await this.registry.rules.call('0')).to.be.eq(
              this.woodenRule.address
            );
          });

          it('qualified without basis', async function() {
            const queryAddr = user;
            const rate = await this.registry.calFeeRateWithoutBasis.call(
              queryAddr,
              '0'
            );
            expect(rate).to.be.bignumber.eq(WOODEN_DISCOUNT);
          });

          it('qualified with basis', async function() {
            const queryAddr = user;
            const rate = await this.registry.calFeeRate.call(queryAddr, '0');
            expect(rate).to.be.bignumber.eq(
              WOODEN_DISCOUNT.mul(BASIS_FEE_RATE).div(BASE)
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

        describe('Metal Cube', function() {
          beforeEach(async function() {
            const receipt = await this.registry.registerRule(
              this.metalRule.address
            );
            expect(await this.registry.rules.call('0')).to.be.eq(
              this.metalRule.address
            );
          });

          it('qualified without basis', async function() {
            const queryAddr = user;
            const rate = await this.registry.calFeeRateWithoutBasis.call(
              queryAddr,
              '0'
            );
            expect(rate).to.be.bignumber.eq(METAL_DISCOUNT);
          });

          it('qualified with basis', async function() {
            const queryAddr = user;
            const rate = await this.registry.calFeeRate.call(queryAddr, '0');
            expect(rate).to.be.bignumber.eq(
              METAL_DISCOUNT.mul(BASIS_FEE_RATE).div(BASE)
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

        describe('Diamond Cube', function() {
          beforeEach(async function() {
            const receipt = await this.registry.registerRule(
              this.diamondRule.address
            );
            expect(await this.registry.rules.call('0')).to.be.eq(
              this.diamondRule.address
            );
          });

          it('qualified without basis', async function() {
            const queryAddr = user;
            const rate = await this.registry.calFeeRateWithoutBasis.call(
              queryAddr,
              '0'
            );
            expect(rate).to.be.bignumber.eq(DIAMOND_DISCOUNT);
          });

          it('qualified with basis', async function() {
            const queryAddr = user;
            const rate = await this.registry.calFeeRate.call(queryAddr, '0');
            expect(rate).to.be.bignumber.eq(
              DIAMOND_DISCOUNT.mul(BASIS_FEE_RATE).div(BASE)
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
      });

      describe('calculate multi', function() {
        beforeEach(async function() {
          // register rules
          await this.registry.registerRule(this.woodenRule.address);
          expect(await this.registry.rules.call('0')).to.be.eq(
            this.woodenRule.address
          );
          await this.registry.registerRule(this.metalRule.address);
          expect(await this.registry.rules.call('1')).to.be.eq(
            this.metalRule.address
          );
          await this.registry.registerRule(this.diamondRule.address);

          expect(await this.registry.rules.call('2')).to.be.eq(
            this.diamondRule.address
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
            WOODEN_DISCOUNT.mul(METAL_DISCOUNT)
              .mul(DIAMOND_DISCOUNT)
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
            WOODEN_DISCOUNT.mul(METAL_DISCOUNT).div(BASE)
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
            WOODEN_DISCOUNT.mul(METAL_DISCOUNT)
              .mul(DIAMOND_DISCOUNT)
              .mul(BASIS_FEE_RATE)
              .div(BASE)
              .div(BASE)
              .div(BASE)
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
            WOODEN_DISCOUNT.mul(METAL_DISCOUNT)
              .mul(BASIS_FEE_RATE)
              .div(BASE)
              .div(BASE)
          );
        });

        it('multiple indexes: qualified for single without basis', async function() {
          const queryAddr = someone;
          await this.wooden.safeTransferFrom(
            user,
            queryAddr,
            this.woodenTokenID,
            {
              from: user,
            }
          );
          const indexes = ['0', '1', '2'];
          const rate = await this.registry.calFeeRateMultiWithoutBasis.call(
            queryAddr,
            indexes
          );
          expect(rate).to.be.bignumber.eq(WOODEN_DISCOUNT);
        });

        it('multiple indexes: qualified for single with basis', async function() {
          const queryAddr = someone;
          await this.wooden.safeTransferFrom(
            user,
            queryAddr,
            this.woodenTokenID,
            {
              from: user,
            }
          );
          const indexes = ['0', '1', '2'];
          const rate = await this.registry.calFeeRateMulti.call(
            queryAddr,
            indexes
          );
          expect(rate).to.be.bignumber.eq(
            WOODEN_DISCOUNT.mul(BASIS_FEE_RATE).div(BASE)
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
    }
  });

  describe('Free Pass', function() {
    if (chainId == 10 || chainId == 42161) {
      beforeEach(async function() {
        await this.registry.registerRule(this.freePassRule.address);
        expect(await this.registry.rules.call('0')).to.be.eq(
          this.freePassRule.address
        );
      });

      it('qualified without basis', async function() {
        const queryAddr = user;
        const rate = await this.registry.calFeeRateWithoutBasis.call(
          queryAddr,
          '0'
        );
        expect(rate).to.be.bignumber.eq(FREE_PASS_DISCOUNT);
      });

      it('qualified with basis', async function() {
        const queryAddr = user;
        const rate = await this.registry.calFeeRate.call(queryAddr, '0');
        expect(rate).to.be.bignumber.eq(
          FREE_PASS_DISCOUNT.mul(BASIS_FEE_RATE).div(BASE)
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
    }
  });
});
