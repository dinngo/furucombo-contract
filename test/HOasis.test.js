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
  USDC_TOKEN,
  ETH_PROVIDER,
  WETH_TOKEN,
  OASIS_DIRECT_PROXY,
  MAKER_OTC,
} = require('./utils/constants');
const {
  evmRevert,
  evmSnapshot,
  mulPercent,
  profileGas,
  getHandlerReturn,
} = require('./utils/utils');

const HOasis = artifacts.require('HOasis');
const Registry = artifacts.require('Registry');
const Proxy = artifacts.require('ProxyMock');
const IToken = artifacts.require('IERC20');
const IOasisDirectProxy = artifacts.require('IOasisDirectProxy');
const IMakerOtc = artifacts.require('IMakerOtc');

// (if tests keep being reverted, check if there are enough liquidity for the tokens)
contract('Oasis Swap', function([_, user, someone]) {
  const slippage = new BN('3');
  let id;
  before(async function() {
    this.registry = await Registry.new();
    this.proxy = await Proxy.new(this.registry.address);
    this.hOasis = await HOasis.new();
    await this.registry.register(
      this.hOasis.address,
      utils.asciiToHex('Oasis')
    );
    this.otc = await IMakerOtc.at(MAKER_OTC);
  });

  beforeEach(async function() {
    id = await evmSnapshot();
  });

  afterEach(async function() {
    await evmRevert(id);
  });

  describe('Ether to Token', function() {
    const tokenAddress = BAT_TOKEN;
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
        const to = this.hOasis.address;
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
          mulPercent(oasisAmount, new BN('100').sub(slippage))
        );
        // TODO: get exact amount using same function call
        // or find out why inaccuracy exists
        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: value,
        });

        const tokenUserEnd = await this.token.balanceOf.call(user);
        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );
        expect(handlerReturn).to.be.bignumber.eq(tokenUserEnd.sub(tokenUser));

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
        const to = this.hOasis.address;
        // TODO: get exact amount using same function call
        // or find out why inaccuracy exists
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
          get110x(oasisAmount)
        );
        await expectRevert(
          this.proxy.execMock(to, data, { from: user, value: value }),
          'HOasis_sellAllAmountPayEth: Unspecified'
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
        const to = this.hOasis.address;
        const oasisAmount = await this.otc.getPayAmount.call(
          WETH_TOKEN,
          tokenAddress,
          buyAmt,
          { from: someone }
        );
        const data = abi.simpleEncode(
          'buyAllAmountPayEth(uint256,address,uint256,address):(uint256)',
          mulPercent(oasisAmount, new BN('100').add(slippage)),
          tokenAddress,
          buyAmt,
          WETH_TOKEN
        );
        // TODO: get exact amount using same function call
        // or find out why inaccuracy exists
        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: value,
        });

        const balanceUserDelta = await balanceUser.delta();
        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );
        expect(handlerReturn).to.be.bignumber.eq(
          balanceUserDelta.add(new BN(receipt.receipt.gasUsed)).neg()
        );

        expect(await this.token.balanceOf.call(user)).to.be.bignumber.eq(
          tokenUser.add(buyAmt)
        );
        expect(
          await this.token.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.eq(ether('0'));
        expect(await balanceProxy.delta()).to.be.bignumber.eq(ether('0'));
        // TODO: modified the expect below when using exact amount
        expect(balanceUserDelta).to.be.bignumber.gt(
          ether('0')
            .sub(getPayBuffer(oasisAmount))
            .sub(new BN(receipt.receipt.gasUsed))
        );
        profileGas(receipt);
      });

      it('insufficient ether', async function() {
        const value = ether('0.001');
        const buyAmt = ether('100');
        const to = this.hOasis.address;
        const data = abi.simpleEncode(
          'buyAllAmountPayEth(uint256,address,uint256,address):(uint256)',
          value,
          tokenAddress,
          buyAmt,
          WETH_TOKEN
        );
        await expectRevert(
          this.proxy.execMock(to, data, {
            from: user,
            value: value,
          }),
          'HOasis_buyAllAmountPayEth: Unspecified'
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
        const to = this.hOasis.address;
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
          mulPercent(result, new BN('100').sub(slippage))
        );
        await this.token.transfer(this.proxy.address, value, {
          from: providerAddress,
        });
        await this.proxy.updateTokenMock(this.token.address);
        await this.token.transfer(someone, value, { from: providerAddress });
        await this.token.approve(this.swap.address, value, {
          from: someone,
        });

        // TODO: get exact amount using same function call
        // or find out why inaccuracy exists
        const receipt = await this.proxy.execMock(to, data, { from: user });

        const balanceUserDelta = await balanceUser.delta();
        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );
        expect(handlerReturn).to.be.bignumber.eq(
          balanceUserDelta.add(new BN(receipt.receipt.gasUsed))
        );

        expect(await this.token.balanceOf.call(user)).to.be.bignumber.eq(
          tokenUser
        );
        expect(
          await this.token.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.eq(ether('0'));
        expect(await balanceProxy.delta()).to.be.bignumber.eq(ether('0'));
        // TODO: modified the expect below when using exact amount
        expect(balanceUserDelta).to.be.bignumber.gt(
          getBuyBuffer(result).sub(new BN(receipt.receipt.gasUsed))
        );
        profileGas(receipt);
      });

      it('min amount too high', async function() {
        const value = ether('100');
        const to = this.hOasis.address;

        await this.token.transfer(this.proxy.address, value, {
          from: providerAddress,
        });
        await this.proxy.updateTokenMock(this.token.address);
        await this.token.transfer(someone, value, { from: providerAddress });
        await this.token.approve(this.swap.address, value, {
          from: someone,
        });

        // TODO: get exact amount using same function call
        // or find out why inaccuracy exists
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
          get110x(result)
        );

        await expectRevert(
          this.proxy.execMock(to, data, { from: user }),
          'HOasis_sellAllAmountBuyEth: Unspecified'
        );
      });
    });

    describe('Exact output', function() {
      it('normal', async function() {
        const value = ether('100');
        const buyAmt = ether('0.1');
        const to = this.hOasis.address;
        const result = await this.otc.getPayAmount.call(
          tokenAddress,
          WETH_TOKEN,
          buyAmt,
          { from: someone }
        );
        const data = abi.simpleEncode(
          'buyAllAmountBuyEth(address,uint256,address,uint256):(uint256)',
          WETH_TOKEN,
          buyAmt,
          tokenAddress,
          mulPercent(result, new BN('100').add(slippage))
        );
        await this.token.transfer(this.proxy.address, value, {
          from: providerAddress,
        });
        await this.proxy.updateTokenMock(this.token.address);
        await this.token.transfer(someone, value, { from: providerAddress });
        await this.token.approve(this.swap.address, value, {
          from: someone,
        });

        // TODO: get exact amount using same function call
        // or find out why inaccuracy exists
        const receipt = await this.proxy.execMock(to, data, {
          from: user,
        });

        const tokenUserEnd = await this.token.balanceOf.call(user);
        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );
        expect(handlerReturn).to.be.bignumber.eq(
          tokenUserEnd
            .sub(value)
            .sub(tokenUser)
            .neg()
        );
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
        const to = this.hOasis.address;
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
        await expectRevert(
          this.proxy.execMock(to, data, {
            from: user,
          }),
          'HOasis_buyAllAmountBuyEth: Unspecified'
        );
      });
    });
  });

  describe('Token to Token', function() {
    const token0Address = DAI_TOKEN;
    const token1Address = USDC_TOKEN;
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
        const to = this.hOasis.address;
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
          mulPercent(result, new BN('100').sub(slippage))
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

        // TODO: get exact amount using same function call
        // or find out why inaccuracy exists
        const receipt = await this.proxy.execMock(to, data, { from: user });

        const token1UserEnd = await this.token1.balanceOf.call(user);
        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );
        expect(handlerReturn).to.be.bignumber.eq(token1UserEnd.sub(token1User));

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
        const to = this.hOasis.address;

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

        // TODO: get exact amount using same function call
        // or find out why inaccuracy exists
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
          get110x(result)
        );

        await expectRevert(
          this.proxy.execMock(to, data, { from: user }),
          'HOasis_sellAllAmount: Unspecified'
        );
      });
    });

    describe('Exact output', function() {
      it('normal', async function() {
        const value = ether('100');
        const buyAmt = new BN('10').mul(new BN(1000000));
        const to = this.hOasis.address;
        const result = await this.otc.getPayAmount.call(
          token0Address,
          token1Address,
          buyAmt,
          { from: someone }
        );
        const data = abi.simpleEncode(
          'buyAllAmount(address,uint256,address,uint256):(uint256)',
          token1Address,
          buyAmt,
          token0Address,
          mulPercent(result, new BN('100').add(slippage))
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

        // TODO: get exact amount using same function call
        // or find out why inaccuracy exists
        const receipt = await this.proxy.execMock(to, data, { from: user });

        const token0UserEnd = await this.token0.balanceOf.call(user);
        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );
        expect(handlerReturn).to.be.bignumber.eq(
          token0UserEnd
            .sub(value)
            .sub(token0User)
            .neg()
        );

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
        const to = this.hOasis.address;
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

        await expectRevert(
          this.proxy.execMock(to, data, { from: user }),
          'HOasis_buyAllAmount: Unspecified'
        );
      });
    });
  });
});

function getBuyBuffer(num) {
  return num.mul(new BN('98')).div(new BN('100'));
}

function getPayBuffer(num) {
  return num.mul(new BN('102')).div(new BN('100'));
}

function get110x(num) {
  return num.mul(new BN('110')).div(new BN('100'));
}
