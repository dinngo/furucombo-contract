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
  DAI_UNISWAP,
  DAI_PROVIDER,
  BAT_TOKEN,
  ETH_PROVIDER,
} = require('./utils/constants');
const {
  evmRevert,
  evmSnapshot,
  mulPercent,
  profileGas,
  getHandlerReturn,
} = require('./utils/utils');

const HUniswap = artifacts.require('HUniswap');
const Registry = artifacts.require('Registry');
const Proxy = artifacts.require('ProxyMock');
const IToken = artifacts.require('IERC20');
const IUniswapExchange = artifacts.require('IUniswapExchange');

contract('Uniswap Swap', function([_, user, someone]) {
  const slippage = new BN('3');
  let id;
  before(async function() {
    this.registry = await Registry.new();
    this.hUniswap = await HUniswap.new();
    await this.registry.register(
      this.hUniswap.address,
      utils.asciiToHex('Uniswap')
    );
    this.proxy = await Proxy.new(this.registry.address);
  });

  beforeEach(async function() {
    id = await evmSnapshot();
  });

  afterEach(async function() {
    await evmRevert(id);
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
        const to = this.hUniswap.address;
        const deadline = (await latest()).add(new BN('100'));
        const uniswapAmount = await this.swap.ethToTokenSwapInput.call(
          new BN('1'),
          deadline,
          { from: user, value: ether('1') }
        );
        const minAmount = mulPercent(
          uniswapAmount,
          new BN('100').sub(slippage)
        );
        const data = abi.simpleEncode(
          'ethToTokenSwapInput(uint256,address,uint256):(uint256)',
          value,
          tokenAddress,
          minAmount
        );
        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: ether('1'),
        });

        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );
        expect(handlerReturn).to.be.bignumber.eq(uniswapAmount);

        expect(await this.token.balanceOf.call(user)).to.be.bignumber.gte(
          tokenUser.add(minAmount)
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

      it('max amount', async function() {
        const value = ether('1');
        const to = this.hUniswap.address;
        const deadline = (await latest()).add(new BN('100'));
        const uniswapAmount = await this.swap.ethToTokenSwapInput.call(
          new BN('1'),
          deadline,
          { from: user, value: ether('1') }
        );
        const minAmount = mulPercent(
          uniswapAmount,
          new BN('100').sub(slippage)
        );
        const data = abi.simpleEncode(
          'ethToTokenSwapInput(uint256,address,uint256):(uint256)',
          MAX_UINT256,
          tokenAddress,
          minAmount
        );
        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: ether('1'),
        });

        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );
        expect(handlerReturn).to.be.bignumber.eq(uniswapAmount);

        expect(await this.token.balanceOf.call(user)).to.be.bignumber.gte(
          tokenUser.add(minAmount)
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
        const to = this.hUniswap.address;
        const deadline = (await latest()).add(new BN('100'));
        const uniswapAmount = await this.swap.ethToTokenSwapInput.call(
          new BN('1'),
          deadline,
          { from: user, value: ether('1') }
        );
        const data = abi.simpleEncode(
          'ethToTokenSwapInput(uint256,address,uint256):(uint256)',
          value,
          tokenAddress,
          uniswapAmount.add(ether('0.1'))
        );
        await expectRevert(
          this.proxy.execMock(to, data, { from: user, value: ether('1') }),
          'HUniswap_ethToTokenSwapInput: Unspecified'
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
        const to = this.hUniswap.address;
        const deadline = (await latest()).add(new BN('100'));
        const uniswapAmount = await this.swap.ethToTokenSwapOutput.call(
          ether('100'),
          deadline,
          { from: user, value: ether('1') }
        );
        const maxAmount = mulPercent(
          uniswapAmount,
          new BN('100').add(slippage)
        );
        const data = abi.simpleEncode(
          'ethToTokenSwapOutput(uint256,address,uint256):(uint256)',
          maxAmount,
          tokenAddress,
          ether('100')
        );
        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: ether('1'),
        });

        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );
        expect(handlerReturn).to.be.bignumber.eq(uniswapAmount);

        expect(await this.token.balanceOf.call(user)).to.be.bignumber.eq(
          tokenUser.add(ether('100'))
        );
        expect(
          await this.token.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.eq(ether('0'));
        expect(await balanceProxy.delta()).to.be.bignumber.eq(ether('0'));
        expect(await balanceUser.delta()).to.be.bignumber.gte(
          ether('0')
            .sub(maxAmount)
            .sub(new BN(receipt.receipt.gasUsed))
        );
        profileGas(receipt);
      });

      it('max amount', async function() {
        const value = ether('1');
        const to = this.hUniswap.address;
        const deadline = (await latest()).add(new BN('100'));
        const uniswapAmount = await this.swap.ethToTokenSwapOutput.call(
          ether('100'),
          deadline,
          { from: user, value: ether('1') }
        );
        const maxAmount = mulPercent(
          uniswapAmount,
          new BN('100').add(slippage)
        );
        const data = abi.simpleEncode(
          'ethToTokenSwapOutput(uint256,address,uint256):(uint256)',
          MAX_UINT256,
          tokenAddress,
          ether('100')
        );
        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: ether('1'),
        });

        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );
        expect(handlerReturn).to.be.bignumber.eq(uniswapAmount);

        expect(await this.token.balanceOf.call(user)).to.be.bignumber.eq(
          tokenUser.add(ether('100'))
        );
        expect(
          await this.token.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.eq(ether('0'));
        expect(await balanceProxy.delta()).to.be.bignumber.eq(ether('0'));
        expect(await balanceUser.delta()).to.be.bignumber.gte(
          ether('0')
            .sub(maxAmount)
            .sub(new BN(receipt.receipt.gasUsed))
        );
        profileGas(receipt);
      });

      it('insufficient ether', async function() {
        const value = ether('0.01');
        const to = this.hUniswap.address;
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
          { from: user, value: ether('1') }
        );
        await expectRevert(
          this.proxy.execMock(to, data, {
            from: user,
            value: ether('1'),
          }),
          'HUniswap_ethToTokenSwapOutput: Unspecified'
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
        const to = this.hUniswap.address;
        await this.token.transfer(someone, value, { from: providerAddress });
        await this.token.approve(this.swap.address, value, {
          from: someone,
        });
        const deadline = (await latest()).add(new BN('100'));
        const result = await this.swap.tokenToEthSwapInput.call(
          value,
          new BN('1'),
          deadline,
          { from: someone }
        );
        const minAmount = mulPercent(result, new BN('100').sub(slippage));
        const data = abi.simpleEncode(
          'tokenToEthSwapInput(address,uint256,uint256):(uint256)',
          tokenAddress,
          value,
          minAmount
        );
        await this.token.transfer(this.proxy.address, value, {
          from: providerAddress,
        });
        await this.proxy.updateTokenMock(this.token.address);
        const receipt = await this.proxy.execMock(to, data, { from: user });
        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );

        const userBalanceDelta = await balanceUser.delta();
        expect(userBalanceDelta).to.be.bignumber.eq(
          handlerReturn.sub(new BN(receipt.receipt.gasUsed))
        );

        expect(await this.token.balanceOf.call(user)).to.be.bignumber.eq(
          tokenUser
        );
        expect(
          await this.token.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.eq(ether('0'));
        expect(await balanceProxy.delta()).to.be.bignumber.eq(ether('0'));
        expect(userBalanceDelta).to.be.bignumber.gte(
          minAmount.sub(new BN(receipt.receipt.gasUsed))
        );
        profileGas(receipt);
      });

      it('max amount', async function() {
        const value = ether('100');
        const to = this.hUniswap.address;
        await this.token.transfer(someone, value, { from: providerAddress });
        await this.token.approve(this.swap.address, value, {
          from: someone,
        });
        const deadline = (await latest()).add(new BN('100'));
        const result = await this.swap.tokenToEthSwapInput.call(
          value,
          new BN('1'),
          deadline,
          { from: someone }
        );
        const minAmount = mulPercent(result, new BN('100').sub(slippage));
        const data = abi.simpleEncode(
          'tokenToEthSwapInput(address,uint256,uint256):(uint256)',
          tokenAddress,
          MAX_UINT256,
          minAmount
        );
        await this.token.transfer(this.proxy.address, value, {
          from: providerAddress,
        });
        await this.proxy.updateTokenMock(this.token.address);
        const receipt = await this.proxy.execMock(to, data, { from: user });
        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );

        const userBalanceDelta = await balanceUser.delta();
        expect(userBalanceDelta).to.be.bignumber.eq(
          handlerReturn.sub(new BN(receipt.receipt.gasUsed))
        );

        expect(await this.token.balanceOf.call(user)).to.be.bignumber.eq(
          tokenUser
        );
        expect(
          await this.token.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.eq(ether('0'));
        expect(await balanceProxy.delta()).to.be.bignumber.eq(ether('0'));
        expect(userBalanceDelta).to.be.bignumber.gte(
          minAmount.sub(new BN(receipt.receipt.gasUsed))
        );
        profileGas(receipt);
      });
    });

    describe('Exact output', function() {
      it('normal', async function() {
        const value = ether('1000');
        const to = this.hUniswap.address;
        await this.token.transfer(someone, value, { from: providerAddress });
        await this.token.approve(this.swap.address, value, {
          from: someone,
        });

        const deadline = (await latest()).add(new BN('100'));
        const result = await this.swap.tokenToEthSwapOutput.call(
          ether('0.1'),
          value,
          deadline,
          { from: someone }
        );
        const maxAmount = mulPercent(result, new BN('100').add(slippage));
        const data = abi.simpleEncode(
          'tokenToEthSwapOutput(address,uint256,uint256):(uint256)',
          tokenAddress,
          ether('0.1'),
          maxAmount
        );
        await this.token.transfer(this.proxy.address, value, {
          from: providerAddress,
        });
        await this.proxy.updateTokenMock(this.token.address);
        const receipt = await this.proxy.execMock(to, data, {
          from: user,
        });
        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );
        const tokenUserEnd = await this.token.balanceOf.call(user);
        expect(tokenUserEnd).to.be.bignumber.eq(value.sub(handlerReturn));

        expect(await this.token.balanceOf.call(user)).to.be.bignumber.gte(
          tokenUser.add(value).sub(maxAmount)
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

      it('max amount', async function() {
        const value = ether('1000');
        const to = this.hUniswap.address;
        await this.token.transfer(someone, value, { from: providerAddress });
        await this.token.approve(this.swap.address, value, {
          from: someone,
        });

        const deadline = (await latest()).add(new BN('100'));
        const result = await this.swap.tokenToEthSwapOutput.call(
          ether('0.1'),
          value,
          deadline,
          { from: someone }
        );
        const maxAmount = mulPercent(result, new BN('100').add(slippage));
        const data = abi.simpleEncode(
          'tokenToEthSwapOutput(address,uint256,uint256):(uint256)',
          tokenAddress,
          ether('0.1'),
          MAX_UINT256
        );
        await this.token.transfer(this.proxy.address, value, {
          from: providerAddress,
        });
        await this.proxy.updateTokenMock(this.token.address);
        const receipt = await this.proxy.execMock(to, data, {
          from: user,
        });
        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );
        const tokenUserEnd = await this.token.balanceOf.call(user);
        expect(tokenUserEnd).to.be.bignumber.eq(value.sub(handlerReturn));

        expect(await this.token.balanceOf.call(user)).to.be.bignumber.gte(
          tokenUser.add(value).sub(maxAmount)
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
        const to = this.hUniswap.address;
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
          { from: someone }
        );
        const minAmount = mulPercent(result, new BN('100').sub(slippage));
        const data = abi.simpleEncode(
          'tokenToTokenSwapInput(address,uint256,uint256,address):(uint256)',
          token0Address,
          value,
          minAmount,
          token1Address
        );
        await this.token0.transfer(this.proxy.address, value, {
          from: providerAddress,
        });
        await this.proxy.updateTokenMock(this.token0.address);
        const receipt = await this.proxy.execMock(to, data, { from: user });
        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );
        const token1UserEnd = await this.token1.balanceOf.call(user);
        expect(handlerReturn).to.be.bignumber.eq(token1UserEnd.sub(token1User));

        expect(await this.token0.balanceOf.call(user)).to.be.bignumber.eq(
          token0User
        );
        expect(
          await this.token0.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.eq(ether('0'));
        expect(await this.token1.balanceOf.call(user)).to.be.bignumber.gte(
          token1User.add(minAmount)
        );
        profileGas(receipt);
      });

      it('max amount', async function() {
        const value = ether('100');
        const to = this.hUniswap.address;
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
          { from: someone }
        );
        const minAmount = mulPercent(result, new BN('100').sub(slippage));
        const data = abi.simpleEncode(
          'tokenToTokenSwapInput(address,uint256,uint256,address):(uint256)',
          token0Address,
          MAX_UINT256,
          minAmount,
          token1Address
        );
        await this.token0.transfer(this.proxy.address, value, {
          from: providerAddress,
        });
        await this.proxy.updateTokenMock(this.token0.address);
        const receipt = await this.proxy.execMock(to, data, { from: user });
        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );
        const token1UserEnd = await this.token1.balanceOf.call(user);
        expect(handlerReturn).to.be.bignumber.eq(token1UserEnd.sub(token1User));

        expect(await this.token0.balanceOf.call(user)).to.be.bignumber.eq(
          token0User
        );
        expect(
          await this.token0.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.eq(ether('0'));
        expect(await this.token1.balanceOf.call(user)).to.be.bignumber.gte(
          token1User.add(minAmount)
        );
        profileGas(receipt);
      });
    });

    describe('Exact output', function() {
      it('normal', async function() {
        const value = ether('100');
        const buyAmt = ether('1');
        const to = this.hUniswap.address;
        await this.token0.transfer(someone, value, {
          from: providerAddress,
        });
        await this.token0.approve(this.swap.address, value, {
          from: someone,
        });
        const deadline = (await latest()).add(new BN('100'));
        const result = await this.swap.tokenToTokenSwapOutput.call(
          buyAmt,
          value,
          MAX_UINT256,
          deadline,
          token1Address,
          { from: someone }
        );
        const maxAmount = mulPercent(result, new BN('100').add(slippage));
        const data = abi.simpleEncode(
          'tokenToTokenSwapOutput(address,uint256,uint256,address):(uint256)',
          token0Address,
          buyAmt,
          maxAmount,
          token1Address
        );
        await this.token0.transfer(this.proxy.address, value, {
          from: providerAddress,
        });
        await this.proxy.updateTokenMock(this.token0.address);
        const receipt = await this.proxy.execMock(to, data, {
          from: user,
        });
        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );
        const token0UserEnd = await this.token0.balanceOf.call(user);
        expect(token0UserEnd).to.be.bignumber.eq(value.sub(handlerReturn));

        expect(await this.token0.balanceOf.call(user)).to.be.bignumber.gte(
          token0User.add(value).sub(maxAmount)
        );
        expect(
          await this.token0.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.eq(ether('0'));
        expect(await this.token1.balanceOf.call(user)).to.be.bignumber.eq(
          token1User.add(buyAmt)
        );
        profileGas(receipt);
      });

      it('max amount', async function() {
        const value = ether('100');
        const buyAmt = ether('1');
        const to = this.hUniswap.address;
        await this.token0.transfer(someone, value, {
          from: providerAddress,
        });
        await this.token0.approve(this.swap.address, value, {
          from: someone,
        });
        const deadline = (await latest()).add(new BN('100'));
        const result = await this.swap.tokenToTokenSwapOutput.call(
          buyAmt,
          value,
          MAX_UINT256,
          deadline,
          token1Address,
          { from: someone }
        );
        const maxAmount = mulPercent(result, new BN('100').add(slippage));
        const data = abi.simpleEncode(
          'tokenToTokenSwapOutput(address,uint256,uint256,address):(uint256)',
          token0Address,
          buyAmt,
          MAX_UINT256,
          token1Address
        );
        await this.token0.transfer(this.proxy.address, value, {
          from: providerAddress,
        });
        await this.proxy.updateTokenMock(this.token0.address);
        const receipt = await this.proxy.execMock(to, data, {
          from: user,
        });
        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );
        const token0UserEnd = await this.token0.balanceOf.call(user);
        expect(token0UserEnd).to.be.bignumber.eq(value.sub(handlerReturn));

        expect(await this.token0.balanceOf.call(user)).to.be.bignumber.gte(
          token0User.add(value).sub(maxAmount)
        );
        expect(
          await this.token0.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.eq(ether('0'));
        expect(await this.token1.balanceOf.call(user)).to.be.bignumber.eq(
          token1User.add(buyAmt)
        );
        profileGas(receipt);
      });
    });
  });
});
