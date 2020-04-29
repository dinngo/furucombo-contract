const {
  balance,
  BN,
  constants,
  ether,
  expectEvent,
  expectRevert,
  time,
} = require('@openzeppelin/test-helpers');
const {tracker} = balance;
const {MAX_UINT256} = constants;
const {latest} = time;
const abi = require('ethereumjs-abi');
const utils = web3.utils;
const {expect} = require('chai');
const {
  DAI_TOKEN,
  DAI_UNISWAP,
  DAI_PROVIDER,
  BAT_TOKEN,
  ETH_PROVIDER,
} = require('./utils/constants');
const {resetAccount, profileGas} = require('./utils/utils');

const HUniswap = artifacts.require('HUniswap');
const Registry = artifacts.require('Registry');
const Proxy = artifacts.require('ProxyMock');
const IToken = artifacts.require('IERC20');
const IUniswapExchange = artifacts.require('IUniswapExchange');

contract('Swap', function([_, deployer, user, someone]) {
  before(async function() {
    this.registry = await Registry.new();
    this.huniswap = await HUniswap.new();
    await this.registry.register(
      this.huniswap.address,
      utils.asciiToHex('Uniswap')
    );
  });

  beforeEach(async function() {
    await resetAccount(_);
    await resetAccount(user);
    this.proxy = await Proxy.new(this.registry.address, {from: deployer});
  });

  describe('Ether to Token', function() {
    const tokenAddress = DAI_TOKEN;
    const uniswapAddress = DAI_UNISWAP;

    let balanceUser;
    let balanceProxy;
    let tokenUser;

    before(async function() {
      this.token = await IToken.at(tokenAddress);
      this.swap = await IUniswapExchange.at(uniswapAddress);
    });

    beforeEach(async function() {
      balanceUser = await tracker(user);
      balanceProxy = await tracker(this.proxy.address);
      tokenUser = await this.token.balanceOf.call(user);
    });

    describe('Exact input', function() {
      it('normal', async function() {
        const value = ether('1');
        const to = this.huniswap.address;
        const data = abi.simpleEncode(
          'ethToTokenSwapInput(uint256,address,uint256):(uint256)',
          value,
          tokenAddress,
          new BN('1')
        );
        const deadline = (await latest()).add(new BN('100'));
        const uniswapAmount = await this.swap.ethToTokenSwapInput.call(
          new BN('1'),
          deadline,
          {from: user, value: ether('1')}
        );
        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: ether('1'),
        });
        expect(await this.token.balanceOf.call(user)).to.be.bignumber.eq(
          tokenUser.add(uniswapAmount)
        );
        expect(
          await this.token.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.eq(ether('0'));
        expect(await balanceProxy.delta()).to.be.bignumber.eq(ether('0'));
        expect(await balanceUser.delta()).to.be.bignumber.eq(
          ether('0')
            .sub(ether('1'))
            .sub(new BN(receipt.receipt.gasUsed))
        );
        profileGas(receipt);
      });

      it('min amount too high', async function() {
        const value = ether('1');
        const to = this.huniswap.address;
        const deadline = (await latest()).add(new BN('100'));
        const uniswapAmount = await this.swap.ethToTokenSwapInput.call(
          new BN('1'),
          deadline,
          {from: user, value: ether('1')}
        );
        const data = abi.simpleEncode(
          'ethToTokenSwapInput(uint256,address,uint256):(uint256)',
          value,
          tokenAddress,
          uniswapAmount.add(ether('0.1'))
        );
        await expectRevert.unspecified(
          this.proxy.execMock(to, data, {from: user, value: ether('1')})
        );
        expect(await this.token.balanceOf.call(user)).to.be.bignumber.eq(
          tokenUser
        );
        expect(
          await this.token.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.eq(ether('0'));
        expect(await balanceProxy.delta()).to.be.bignumber.eq(ether('0'));
      });
    });

    describe('Exact output', function() {
      it('normal', async function() {
        const value = ether('1');
        const to = this.huniswap.address;
        const data = abi.simpleEncode(
          'ethToTokenSwapOutput(uint256,address,uint256):(uint256)',
          value,
          tokenAddress,
          ether('100')
        );
        const deadline = (await latest()).add(new BN('100'));
        const uniswapAmount = await this.swap.ethToTokenSwapOutput.call(
          ether('100'),
          deadline,
          {from: user, value: ether('1')}
        );
        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: ether('1'),
        });
        expect(await this.token.balanceOf.call(user)).to.be.bignumber.eq(
          tokenUser.add(ether('100'))
        );
        expect(
          await this.token.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.eq(ether('0'));
        expect(await balanceProxy.delta()).to.be.bignumber.eq(ether('0'));
        expect(await balanceUser.delta()).to.be.bignumber.eq(
          ether('0')
            .sub(uniswapAmount)
            .sub(new BN(receipt.receipt.gasUsed))
        );
        profileGas(receipt);
      });

      it('insufficient ether', async function() {
        const value = ether('0.1');
        const to = this.huniswap.address;
        const data = abi.simpleEncode(
          'ethToTokenSwapOutput(uint256,address,uint256):(uint256)',
          value,
          tokenAddress,
          ether('100')
        );
        const deadline = (await latest()).add(new BN('100'));
        const uniswapAmount = await this.swap.ethToTokenSwapOutput.call(
          ether('100'),
          deadline,
          {from: user, value: ether('1')}
        );
        await expectRevert.unspecified(
          this.proxy.execMock(to, data, {
            from: user,
            value: ether('1'),
          })
        );
      });
    });
  });

  describe('Token to Ether', function() {
    const tokenAddress = DAI_TOKEN;
    const uniswapAddress = DAI_UNISWAP;
    const providerAddress = DAI_PROVIDER;

    let balanceUser;
    let balanceProxy;
    let tokenUser;

    before(async function() {
      this.token = await IToken.at(tokenAddress);
      this.swap = await IUniswapExchange.at(uniswapAddress);
    });

    beforeEach(async function() {
      balanceUser = await tracker(user);
      balanceProxy = await tracker(this.proxy.address);
      tokenUser = await this.token.balanceOf(user);
    });

    describe('Exact input', function() {
      it('normal', async function() {
        const value = ether('100');
        const to = this.huniswap.address;
        const data = abi.simpleEncode(
          'tokenToEthSwapInput(address,uint256,uint256):(uint256)',
          tokenAddress,
          value,
          new BN('1')
        );
        await this.token.transfer(this.proxy.address, value, {
          from: providerAddress,
        });
        await this.proxy.updateTokenMock(this.token.address);
        await this.token.transfer(someone, value, {from: providerAddress});
        await this.token.approve(this.swap.address, value, {
          from: someone,
        });

        const deadline = (await latest()).add(new BN('100'));
        const result = await this.swap.tokenToEthSwapInput.call(
          value,
          new BN('1'),
          deadline,
          {from: someone}
        );
        const receipt = await this.proxy.execMock(to, data, {from: user});

        expect(await this.token.balanceOf.call(user)).to.be.bignumber.eq(
          tokenUser
        );
        expect(
          await this.token.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.eq(ether('0'));
        expect(await balanceProxy.delta()).to.be.bignumber.eq(ether('0'));
        expect(await balanceUser.delta()).to.be.bignumber.eq(
          result.sub(new BN(receipt.receipt.gasUsed))
        );
        profileGas(receipt);
      });
    });

    describe('Exact output', function() {
      it('normal', async function() {
        const value = ether('100');
        const to = this.huniswap.address;
        const data = abi.simpleEncode(
          'tokenToEthSwapOutput(address,uint256,uint256):(uint256)',
          tokenAddress,
          ether('0.1'),
          value
        );
        await this.token.transfer(this.proxy.address, value, {
          from: providerAddress,
        });
        await this.proxy.updateTokenMock(this.token.address);
        await this.proxy.updateTokenMock(this.token.address);
        await this.token.transfer(someone, value, {from: providerAddress});
        await this.token.approve(this.swap.address, value, {
          from: someone,
        });

        const deadline = (await latest()).add(new BN('100'));
        const result = await this.swap.tokenToEthSwapOutput.call(
          ether('0.1'),
          value,
          deadline,
          {from: someone}
        );
        const receipt = await this.proxy.execMock(to, data, {
          from: user,
        });
        expect(await this.token.balanceOf.call(user)).to.be.bignumber.eq(
          tokenUser.add(value).sub(result)
        );
        expect(
          await this.token.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.eq(ether('0'));
        expect(await balanceProxy.delta()).to.be.bignumber.eq(ether('0'));
        expect(await balanceUser.delta()).to.be.bignumber.eq(
          ether('0.1').sub(new BN(receipt.receipt.gasUsed))
        );
        profileGas(receipt);
      });
    });
  });

  describe('Token to Token', function() {
    const token0Address = DAI_TOKEN;
    const token1Address = BAT_TOKEN;
    const uniswapAddress = DAI_UNISWAP;
    const providerAddress = DAI_PROVIDER;

    let token0User;
    let token1User;

    before(async function() {
      this.token0 = await IToken.at(token0Address);
      this.token1 = await IToken.at(token1Address);
      this.swap = await IUniswapExchange.at(uniswapAddress);
    });

    beforeEach(async function() {
      token0User = await this.token0.balanceOf.call(user);
      token1User = await this.token1.balanceOf.call(user);
    });

    describe('Exact input', function() {
      it('normal', async function() {
        const value = ether('100');
        const to = this.huniswap.address;
        const data = abi.simpleEncode(
          'tokenToTokenSwapInput(address,uint256,uint256,address):(uint256)',
          token0Address,
          value,
          new BN('1'),
          token1Address
        );
        await this.token0.transfer(this.proxy.address, value, {
          from: providerAddress,
        });
        await this.proxy.updateTokenMock(this.token0.address);
        await this.token0.transfer(someone, value, {
          from: providerAddress,
        });
        await this.token0.approve(this.swap.address, value, {
          from: someone,
        });

        const deadline = (await latest()).add(new BN('100'));
        const result = await this.swap.tokenToTokenSwapInput.call(
          value,
          new BN('1'),
          new BN('1'),
          deadline,
          token1Address,
          {from: someone}
        );
        const receipt = await this.proxy.execMock(to, data, {from: user});

        expect(await this.token0.balanceOf.call(user)).to.be.bignumber.eq(
          token0User
        );
        expect(
          await this.token0.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.eq(ether('0'));
        expect(await this.token1.balanceOf.call(user)).to.be.bignumber.eq(
          result
        );
        profileGas(receipt);
      });
    });

    describe('Exact output', function() {
      it('normal', async function() {
        const value = ether('100');
        const to = this.huniswap.address;
        const data = abi.simpleEncode(
          'tokenToTokenSwapOutput(address,uint256,uint256,address):(uint256)',
          token0Address,
          value,
          value,
          token1Address
        );
        await this.token0.transfer(this.proxy.address, value, {
          from: providerAddress,
        });
        await this.proxy.updateTokenMock(this.token0.address);
        await this.token0.transfer(someone, value, {
          from: providerAddress,
        });
        await this.token0.approve(this.swap.address, value, {
          from: someone,
        });

        const deadline = (await latest()).add(new BN('100'));
        const result = await this.swap.tokenToTokenSwapOutput.call(
          value,
          value,
          MAX_UINT256,
          deadline,
          token1Address,
          {from: someone}
        );
        const receipt = await this.proxy.execMock(to, data, {
          from: user,
        });
        expect(await this.token0.balanceOf.call(user)).to.be.bignumber.eq(
          token0User.add(value).sub(result)
        );
        expect(
          await this.token0.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.eq(ether('0'));
        expect(await this.token1.balanceOf.call(user)).to.be.bignumber.eq(
          token1User.add(value)
        );
        profileGas(receipt);
      });
    });
  });
});
