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

const {
  BAT_TOKEN,
  DAI_TOKEN,
  DAI_PROVIDER,
  KYBERNETWORK_PROXY
} = require("./utils/constants");
const { resetAccount } = require("./utils/utils");

const HKyberNetwork = artifacts.require("HKyberNetwork");
const Registry = artifacts.require("Registry");
const Proxy = artifacts.require("Proxy");
const IToken = artifacts.require("IERC20");
const IKyberNetworkProxy = artifacts.require("IKyberNetworkProxy");

contract("KyberNetwork Swap", function([
  _,
  deployer,
  user1,
  user2,
  user3,
  someone
]) {
  const tokenAddress = DAI_TOKEN;
  const providerAddress = DAI_PROVIDER;

  let balanceUser1;
  let balanceUser2;
  let balanceUser3;
  let balanceProxy;

  before(async function() {
    this.registry = await Registry.new();
    this.proxy = await Proxy.new(this.registry.address);
    this.hkybernetwork = await HKyberNetwork.new();
    await this.registry.register(
      this.hkybernetwork.address,
      utils.asciiToHex("Kyberswap")
    );
    this.token = await IToken.at(tokenAddress);
    this.swap = await IKyberNetworkProxy.at(KYBERNETWORK_PROXY);
  });

  beforeEach(async function() {
    await resetAccount(_);
    await resetAccount(user1);
    await resetAccount(user2);
    await resetAccount(user3);
    balanceUser1 = await tracker(user1);
    balanceUser2 = await tracker(user2);
    balanceUser3 = await tracker(user3);
    balanceProxy = await tracker(this.proxy.address);
  });

  describe("Ether to Token", function() {
    describe("Exact input", function() {
      it("normal", async function() {
        const value = [ether("1")];
        const to = [this.hkybernetwork.address];
        const rate = await this.swap.getExpectedRate.call(
          "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
          tokenAddress,
          ether("1")
        );
        const data = [
          abi.simpleEncode(
            "swapEtherToToken(uint256,address,uint256):(uint256)",
            value[0],
            tokenAddress,
            rate[1]
          )
        ];
        const kyberswapAmount = value[0].mul(rate[1]).div(ether("1"));
        const receipt = await this.proxy.batchExec(to, data, {
          from: user1,
          value: ether("1")
        });
        expect(await this.token.balanceOf.call(user1)).to.be.bignumber.gt(
          kyberswapAmount
        );
        expect(
          await this.token.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.eq(ether("0"));
        expect(await balanceProxy.delta()).to.be.bignumber.eq(ether("0"));
        expect(await balanceUser1.delta()).to.be.bignumber.eq(
          ether("0")
            .sub(ether("1"))
            .sub(new BN(receipt.receipt.gasUsed))
        );
      });

      it("min rate too high", async function() {
        const value = [ether("1")];
        const to = [this.hkybernetwork.address];
        const rate = await this.swap.getExpectedRate.call(
          "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
          tokenAddress,
          ether("1")
        );
        const data = [
          abi.simpleEncode(
            "swapEtherToToken(uint256,address,uint256):(uint256)",
            value[0],
            tokenAddress,
            rate[0].mul(new BN("1.5"))
          )
        ];
        await expectRevert.unspecified(
          this.proxy.batchExec(to, data, {
            from: user2,
            value: ether("1")
          })
        );
        expect(await this.token.balanceOf.call(user2)).to.be.bignumber.eq(
          ether("0")
        );
        expect(
          await this.token.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.eq(ether("0"));
        expect(await balanceProxy.delta()).to.be.bignumber.eq(ether("0"));
      });
    });
  });

  describe("Token to Ether", function() {
    describe("Exact input", function() {
      it("normal", async function() {
        const value = [ether("1")];
        const to = [this.hkybernetwork.address];
        const rate = await this.swap.getExpectedRate.call(
          tokenAddress,
          "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
          ether("1")
        );
        const data = [
          abi.simpleEncode(
            "swapTokenToEther(address,uint256,uint256):(uint256)",
            tokenAddress,
            value[0],
            rate[1]
          )
        ];
        await this.token.transfer(this.proxy.address, value[0], {
          from: providerAddress
        });
        const kyberswapAmount = value[0].mul(rate[1]).div(ether("1"));
        const receipt = await this.proxy.batchExec(to, data, {
          from: user2,
          value: ether("1")
        });

        expect(await this.token.balanceOf.call(user2)).to.be.bignumber.eq(
          ether("0")
        );
        expect(
          await this.token.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.eq(ether("0"));
        expect(await balanceProxy.delta()).to.be.bignumber.eq(ether("0"));
        expect(await balanceUser2.delta()).to.be.bignumber.gt(
          kyberswapAmount.sub(new BN(receipt.receipt.gasUsed))
        );
      });
    });
  });

  describe("Token to Token", function() {
    const srcTokenAddress = tokenAddress;
    const destTokenAddress = BAT_TOKEN;

    before(async function() {
      this.destToken = await IToken.at(destTokenAddress);
    });

    describe("Exact input", function() {
      it("normal", async function() {
        const value = [ether("1")];
        const to = [this.hkybernetwork.address];
        const rate = await this.swap.getExpectedRate.call(
          srcTokenAddress,
          destTokenAddress,
          ether("1")
        );
        const data = [
          abi.simpleEncode(
            "swapTokenToToken(address,uint256,address,uint256):(uint256)",
            srcTokenAddress,
            value[0],
            destTokenAddress,
            rate[1]
          )
        ];
        await this.token.transfer(this.proxy.address, value[0], {
          from: providerAddress
        });
        const kyberswapAmount = value[0].mul(rate[1]).div(ether("1"));
        const receipt = await this.proxy.batchExec(to, data, {
          from: user3,
          value: ether("1")
        });

        expect(await this.token.balanceOf.call(user3)).to.be.bignumber.eq(
          ether("0")
        );
        expect(
          await this.token.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.eq(ether("0"));
        expect(await this.destToken.balanceOf.call(user3)).to.be.bignumber.gt(
          kyberswapAmount
        );
        expect(
          await this.destToken.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.eq(ether("0"));
        expect(await balanceUser3.delta()).to.be.bignumber.eq(
          ether("0").sub(new BN(receipt.receipt.gasUsed))
        );
        expect(await balanceProxy.delta()).to.be.bignumber.eq(ether("0"));
      });
    });
  });
});
