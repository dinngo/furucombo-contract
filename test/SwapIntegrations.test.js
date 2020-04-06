const {
  balance,
  BN,
  constants,
  ether,
  expectEvent,
  expectRevert,
  time
} = require("@openzeppelin/test-helpers");
const { tracker } = balance;
const { latest } = time;
const abi = require("ethereumjs-abi");
const utils = web3.utils;

const { expect } = require("chai");

const { DAI_TOKEN, DAI_UNISWAP, CDAI } = require("./utils/constants");
const { resetAccount } = require("./utils/utils");

const HUniswap = artifacts.require("HUniswap");
const HCToken = artifacts.require("HCToken");
const Registry = artifacts.require("Registry");
const Proxy = artifacts.require("Proxy");
const IToken = artifacts.require("IERC20");
const ICToken = artifacts.require("ICToken");
const IUniswapExchange = artifacts.require("IUniswapExchange");

contract("SwapIntegration", function([_, deployer, user1]) {
  const tokenAddress = DAI_TOKEN;

  let balanceUser1;
  let balanceProxy;

  before(async function() {
    this.registry = await Registry.new();
    this.proxy = await Proxy.new(this.registry.address);
  });

  beforeEach(async function() {
    await resetAccount(_);
    await resetAccount(user1);
    balanceUser1 = await tracker(user1);
    balanceProxy = await tracker(this.proxy.address);
  });

  describe("Uniswap Swap", function() {
    const uniswapAddress = DAI_UNISWAP;

    before(async function() {
      this.huniswap = await HUniswap.new({ from: deployer });
      await this.registry.register(
        this.huniswap.address,
        utils.asciiToHex("Uniswap")
      );
      this.token = await IToken.at(tokenAddress);
      this.swap = await IUniswapExchange.at(uniswapAddress);
    });

    describe("Uniswap Addliquidity", function() {
      it("normal", async function() {
        const value = [ether("0.51"), ether("0.49")];
        const deadline = (await latest()).add(new BN("100"));
        const maxToken = await this.swap.ethToTokenSwapInput.call(
          new BN("1"),
          deadline,
          { from: user1, value: value[0] }
        );
        const to = [this.huniswap.address, this.huniswap.address];
        const data = [
          abi.simpleEncode(
            "ethToTokenSwapInput(uint256,address,uint256):(uint256)",
            value[0],
            tokenAddress,
            new BN("1")
          ),
          abi.simpleEncode(
            "addLiquidity(uint256,address,uint256):(uint256)",
            value[1],
            tokenAddress,
            maxToken
          )
        ];
        const receipt = await this.proxy.batchExec(to, data, {
          from: user1,
          value: ether("1")
        });
        expect(await balanceUser1.delta()).to.be.bignumber.eq(
          ether("0")
            .sub(value[0])
            .sub(value[1])
            .sub(new BN(receipt.receipt.gasUsed))
        );
        expect(await this.swap.balanceOf.call(user1)).to.be.bignumber.gt(
          ether("0")
        );
      });
    });

    /* Needs to deal with the re-enter issue
        describe('Compound Token Lending', function () {
            const ctokenAddress = CDAI;

            before(async function () {
                this.hctoken = await HCToken.new();
                await this.registry.register(this.hctoken.address, utils.asciiToHex("CToken"));
                this.ctoken = await ICToken.at(ctokenAddress);
            });

            it('normal', async function () {
                let value = [
                    ether('0.1'),
                    ether('0'),
                ];
                const deadline = (await latest()).add(new BN('100'));
                value[1] = await this.swap.ethToTokenSwapInput.call(
                    new BN('1'),
                    deadline,
                    { from: user1, value: value[0] }
                );
                const to = [
                    this.huniswap.address,
                    this.hctoken.address,
                ];
                const data = [
                    abi.simpleEncode(
                        'ethToTokenSwapInput(uint256,address,uint256):(uint256)',
                        value[0],
                        tokenAddress,
                        new BN('1')
                    ),
                    abi.simpleEncode('mint(address,uint256)', ctokenAddress, value[1]),
                ];
                const rate = await this.ctoken.exchangeRateStored.call();
                const result = value[1].mul(ether('1')).div(rate);
                const receipt = await this.proxy.batchExec(to, data, { from: user1, value: ether('1') });
                const ctokenUser1 = await this.ctoken.balanceOf.call(user1);
                expect(ctokenUser1.mul(new BN('1000')).divRound(result)).to.be.bignumber.eq(new BN('1000'));
            });
        });
*/
  });
});
