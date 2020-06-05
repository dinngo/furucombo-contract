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
const { MAX_UINT256 } = constants;
const { latest } = time;
const abi = require('ethereumjs-abi');
const utils = web3.utils;
const { expect } = require('chai');
const {
  DAI_TOKEN,
  DAI_PROVIDER,
  BAT_TOKEN,
  ETH_PROVIDER,
  WETH_TOKEN,
  OASIS_DIRECT_PROXY,
  MAKER_OTC,
} = require('./utils/constants');
const { resetAccount, profileGas } = require('./utils/utils');

const HOasis = artifacts.require('HOasis');
const Registry = artifacts.require('Registry');
const Proxy = artifacts.require('ProxyMock');
const IToken = artifacts.require('IERC20');
const IOasisDirectProxy = artifacts.require('IOasisDirectProxy');
const IMakerOtc = artifacts.require('IMakerOtc');

contract('Oasis Swap', function([_, deployer, user, someone]) {
  before(async function() {
    this.registry = await Registry.new();
    this.hoasis = await HOasis.new();
    await this.registry.register(
      this.hoasis.address,
      utils.asciiToHex('Oasis')
    );
    this.otc = await IMakerOtc.at(MAKER_OTC);
  });

  beforeEach(async function() {
    await resetAccount(_);
    await resetAccount(user);
    this.proxy = await Proxy.new(this.registry.address, { from: deployer });
  });

  describe('Ether to Token', function() {
    const tokenAddress = DAI_TOKEN;
    const oasisAddress = OASIS_DIRECT_PROXY;

    let balanceUser;
    let balanceProxy;
    let tokenUser;

    before(async function() {
      this.token = await IToken.at(tokenAddress);
      this.swap = await IOasisDirectProxy.at(oasisAddress);
    });

    beforeEach(async function() {
      balanceUser = await tracker(user);
      balanceProxy = await tracker(this.proxy.address);
      tokenUser = await this.token.balanceOf.call(user);
    });

    describe('Exact input', function() {
      it('normal', async function() {
        const value = ether('1');
        const to = this.hoasis.address;
        const data = abi.simpleEncode(
          'sellAllAmountPayEth(uint256,address,address,uint256):(uint256)',
          value,
          WETH_TOKEN,
          tokenAddress,
          new BN('1')
        );
        // TODO: should get exact amount using same function call
        const oasisAmount = await this.otc.getBuyAmount.call(
          tokenAddress,
          WETH_TOKEN,
          value,
          { from: someone }
        );
        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: value,
        });
        // TODO: modified the expect below when using exact amount
        expect(await this.token.balanceOf.call(user)).to.be.bignumber.gt(
          tokenUser.add(getBuyBuffer(oasisAmount))
        );
        expect(
          await this.token.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.eq(ether('0'));
        expect(await balanceProxy.delta()).to.be.bignumber.eq(ether('0'));
        expect(await balanceUser.delta()).to.be.bignumber.eq(
          ether('0')
            .sub(value)
            .sub(new BN(receipt.receipt.gasUsed))
        );
        profileGas(receipt);
      });

      it('min amount too high', async function() {
        const value = ether('1');
        const to = this.hoasis.address;
        // TODO: should get exact amount using same function call
        const oasisAmount = await this.otc.getBuyAmount.call(
          tokenAddress,
          WETH_TOKEN,
          value,
          { from: someone }
        );
        const data = abi.simpleEncode(
          'sellAllAmountPayEth(uint256,address,address,uint256):(uint256)',
          value,
          WETH_TOKEN,
          tokenAddress,
          oasisAmount.add(ether('5'))
        );
        await expectRevert.unspecified(
          this.proxy.execMock(to, data, { from: user, value: value })
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
        const buyAmt = ether('100');
        const to = this.hoasis.address;
        const data = abi.simpleEncode(
          'buyAllAmountPayEth(uint256,address,uint256,address):(uint256)',
          value,
          tokenAddress,
          buyAmt,
          WETH_TOKEN
        );
        // TODO: should get exact amount using same function call
        const oasisAmount = await this.otc.getPayAmount.call(
          WETH_TOKEN,
          tokenAddress,
          buyAmt,
          { from: someone }
        );
        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: value,
        });
        expect(await this.token.balanceOf.call(user)).to.be.bignumber.eq(
          tokenUser.add(buyAmt)
        );
        expect(
          await this.token.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.eq(ether('0'));
        expect(await balanceProxy.delta()).to.be.bignumber.eq(ether('0'));
        // TODO: modified the expect below when using exact amount
        expect(await balanceUser.delta()).to.be.bignumber.gt(
          ether('0')
            .sub(getPayBuffer(oasisAmount))
            .sub(new BN(receipt.receipt.gasUsed))
        );
        profileGas(receipt);
      });

      it('insufficient ether', async function() {
        const value = ether('0.001');
        const buyAmt = ether('100');
        const to = this.hoasis.address;
        const data = abi.simpleEncode(
          'buyAllAmountPayEth(uint256,address,uint256,address):(uint256)',
          value,
          tokenAddress,
          buyAmt,
          WETH_TOKEN
        );
        await expectRevert.unspecified(
          this.proxy.execMock(to, data, {
            from: user,
            value: value,
          })
        );
      });
    });
  });

  describe('Token to Ether', function() {
    const tokenAddress = DAI_TOKEN;
    const oasisAddress = OASIS_DIRECT_PROXY;
    const providerAddress = DAI_PROVIDER;

    let balanceUser;
    let balanceProxy;
    let tokenUser;

    before(async function() {
      this.token = await IToken.at(tokenAddress);
      this.swap = await IOasisDirectProxy.at(oasisAddress);
    });

    beforeEach(async function() {
      balanceUser = await tracker(user);
      balanceProxy = await tracker(this.proxy.address);
      tokenUser = await this.token.balanceOf(user);
    });

    describe('Exact input', function() {
      it('normal', async function() {
        const value = ether('100');
        const to = this.hoasis.address;
        const data = abi.simpleEncode(
          'sellAllAmountBuyEth(address,uint256,address,uint256):(uint256)',
          tokenAddress,
          value,
          WETH_TOKEN,
          new BN('1')
        );
        await this.token.transfer(this.proxy.address, value, {
          from: providerAddress,
        });
        await this.proxy.updateTokenMock(this.token.address);
        await this.token.transfer(someone, value, { from: providerAddress });
        await this.token.approve(this.swap.address, value, {
          from: someone,
        });

        // TODO: should get exact amount using same function call
        const result = await this.otc.getBuyAmount.call(
          WETH_TOKEN,
          tokenAddress,
          value,
          { from: someone }
        );
        const receipt = await this.proxy.execMock(to, data, { from: user });

        expect(await this.token.balanceOf.call(user)).to.be.bignumber.eq(
          tokenUser
        );
        expect(
          await this.token.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.eq(ether('0'));
        expect(await balanceProxy.delta()).to.be.bignumber.eq(ether('0'));
        // TODO: modified the expect below when using exact amount
        expect(await balanceUser.delta()).to.be.bignumber.gt(
          getBuyBuffer(result).sub(new BN(receipt.receipt.gasUsed))
        );
        profileGas(receipt);
      });

      it('min amount too high', async function() {
        const value = ether('100');
        const to = this.hoasis.address;

        await this.token.transfer(this.proxy.address, value, {
          from: providerAddress,
        });
        await this.proxy.updateTokenMock(this.token.address);
        await this.token.transfer(someone, value, { from: providerAddress });
        await this.token.approve(this.swap.address, value, {
          from: someone,
        });

        // TODO: should get exact amount using same function call
        const result = await this.otc.getBuyAmount.call(
          WETH_TOKEN,
          tokenAddress,
          value,
          { from: someone }
        );
        const data = abi.simpleEncode(
          'sellAllAmountBuyEth(address,uint256,address,uint256):(uint256)',
          tokenAddress,
          value,
          WETH_TOKEN,
          result.add(ether('0.1'))
        );

        await expectRevert.unspecified(
          this.proxy.execMock(to, data, { from: user })
        );
      });
    });

    describe('Exact output', function() {
      it('normal', async function() {
        const value = ether('100');
        const buyAmt = ether('0.1');
        const to = this.hoasis.address;
        const data = abi.simpleEncode(
          'buyAllAmountBuyEth(address,uint256,address,uint256):(uint256)',
          WETH_TOKEN,
          buyAmt,
          tokenAddress,
          value
        );
        await this.token.transfer(this.proxy.address, value, {
          from: providerAddress,
        });
        await this.proxy.updateTokenMock(this.token.address);
        await this.token.transfer(someone, value, { from: providerAddress });
        await this.token.approve(this.swap.address, value, {
          from: someone,
        });

        // TODO: should get exact amount using same function call
        const result = await this.otc.getPayAmount.call(
          tokenAddress,
          WETH_TOKEN,
          buyAmt,
          { from: someone }
        );
        const receipt = await this.proxy.execMock(to, data, {
          from: user,
        });
        // TODO: modified the expect below when using exact amount
        expect(await this.token.balanceOf.call(user)).to.be.bignumber.gt(
          tokenUser.add(value).sub(getPayBuffer(result))
        );
        expect(
          await this.token.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.eq(ether('0'));
        expect(await balanceProxy.delta()).to.be.bignumber.eq(ether('0'));
        expect(await balanceUser.delta()).to.be.bignumber.eq(
          buyAmt.sub(new BN(receipt.receipt.gasUsed))
        );
        profileGas(receipt);
      });

      it('insufficient token input', async function() {
        const value = new BN('100');
        const buyAmt = ether('1');
        const to = this.hoasis.address;
        const data = abi.simpleEncode(
          'buyAllAmountBuyEth(address,uint256,address,uint256):(uint256)',
          WETH_TOKEN,
          buyAmt,
          tokenAddress,
          value
        );
        await this.token.transfer(this.proxy.address, value, {
          from: providerAddress,
        });
        await this.proxy.updateTokenMock(this.token.address);
        await expectRevert.unspecified(
          this.proxy.execMock(to, data, {
            from: user,
          })
        );
      });
    });
  });

  describe('Token to Token', function() {
    const token0Address = DAI_TOKEN;
    const token1Address = BAT_TOKEN;
    const oasisAddress = OASIS_DIRECT_PROXY;
    const providerAddress = DAI_PROVIDER;

    let token0User;
    let token1User;

    before(async function() {
      this.token0 = await IToken.at(token0Address);
      this.token1 = await IToken.at(token1Address);
      this.swap = await IOasisDirectProxy.at(oasisAddress);
    });

    beforeEach(async function() {
      token0User = await this.token0.balanceOf.call(user);
      token1User = await this.token1.balanceOf.call(user);
    });

    describe('Exact input', function() {
      it('normal', async function() {
        const value = ether('100');
        const to = this.hoasis.address;
        const data = abi.simpleEncode(
          'sellAllAmount(address,uint256,address,uint256):(uint256)',
          token0Address,
          value,
          token1Address,
          new BN('1')
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

        // TODO: should get exact amount using same function call
        const result = await this.otc.getBuyAmount.call(
          token1Address,
          token0Address,
          value,
          { from: someone }
        );
        const receipt = await this.proxy.execMock(to, data, { from: user });

        expect(await this.token0.balanceOf.call(user)).to.be.bignumber.eq(
          token0User
        );
        expect(
          await this.token0.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.eq(ether('0'));
        expect(
          await this.token1.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.eq(ether('0'));
        // TODO: modified the expect below when using exact amount
        expect(await this.token1.balanceOf.call(user)).to.be.bignumber.gt(
          getBuyBuffer(result)
        );
        profileGas(receipt);
      });

      it('min amount too high', async function() {
        const value = ether('100');
        const to = this.hoasis.address;

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

        // TODO: should get exact amount using same function call
        const result = await this.otc.getBuyAmount.call(
          token1Address,
          token0Address,
          value,
          { from: someone }
        );
        const data = abi.simpleEncode(
          'sellAllAmount(address,uint256,address,uint256):(uint256)',
          token0Address,
          value,
          token1Address,
          result.add(ether('0.1'))
        );

        await expectRevert.unspecified(
          this.proxy.execMock(to, data, { from: user })
        );
      });
    });

    describe('Exact output', function() {
      it('normal', async function() {
        const value = ether('100');
        const buyAmt = ether('10');
        const to = this.hoasis.address;
        const data = abi.simpleEncode(
          'buyAllAmount(address,uint256,address,uint256):(uint256)',
          token1Address,
          buyAmt,
          token0Address,
          value
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

        // TODO: should get exact amount using same function call
        const result = await this.otc.getPayAmount.call(
          token0Address,
          token1Address,
          buyAmt,
          { from: someone }
        );
        const receipt = await this.proxy.execMock(to, data, { from: user });

        // TODO: modified the expect below when using exact amount
        expect(await this.token0.balanceOf.call(user)).to.be.bignumber.gt(
          token0User.add(value).sub(getPayBuffer(result))
        );
        expect(
          await this.token0.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.eq(ether('0'));
        expect(
          await this.token1.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.eq(ether('0'));
        expect(await this.token1.balanceOf.call(user)).to.be.bignumber.eq(
          token1User.add(buyAmt)
        );
        profileGas(receipt);
      });

      it('insufficient token0 input', async function() {
        const value = ether('0.1');
        const buyAmt = ether('100');
        const to = this.hoasis.address;
        const data = abi.simpleEncode(
          'buyAllAmount(address,uint256,address,uint256):(uint256)',
          token1Address,
          buyAmt,
          token0Address,
          value
        );
        await this.token0.transfer(this.proxy.address, value, {
          from: providerAddress,
        });
        await this.proxy.updateTokenMock(this.token0.address);

        await expectRevert.unspecified(
          this.proxy.execMock(to, data, { from: user })
        );
      });
    });
  });
});

function getBuyBuffer(num){
  return num
    .mul(new BN('98'))
    .div(new BN('100'));
}

function getPayBuffer(num){
  return num
    .mul(new BN('102'))
    .div(new BN('100'));
}