const {
  balance,
  BN,
  constants,
  ether,
  expectRevert,
} = require('@openzeppelin/test-helpers');
const { tracker } = balance;
const { MAX_UINT256 } = constants;
const abi = require('ethereumjs-abi');
const utils = web3.utils;
const { expect } = require('chai');
const {
  DAI_TOKEN,
  BAT_TOKEN,
  WETH_TOKEN,
  UNISWAPV2_ROUTER02,
  HBTC_TOKEN,
  HBTC_PROVIDER,
  OMG_TOKEN,
  USDT_TOKEN,
} = require('./utils/constants');
const {
  evmRevert,
  evmSnapshot,
  mulPercent,
  profileGas,
  getHandlerReturn,
  tokenProviderSushi,
  impersonateAndInjectEther,
} = require('./utils/utils');

const HUniswapV2 = artifacts.require('HUniswapV2');
const Registry = artifacts.require('Registry');
const Proxy = artifacts.require('ProxyMock');
const IToken = artifacts.require('IERC20');
const IUniswapV2Router = artifacts.require('IUniswapV2Router02');
const IUsdt = artifacts.require('IERC20Usdt');

contract('UniswapV2 Swap', function([_, user, someone]) {
  let id;
  const slippage = new BN('3');

  let hbtcProviderAddress;
  let omgProviderAddress;
  let usdtProviderAddress;

  before(async function() {
    hbtcProviderAddress = HBTC_PROVIDER;
    omgProviderAddress = await tokenProviderSushi(OMG_TOKEN);
    usdtProviderAddress = await tokenProviderSushi(USDT_TOKEN);

    this.registry = await Registry.new();
    this.hUniswapV2 = await HUniswapV2.new();
    await this.registry.register(
      this.hUniswapV2.address,
      utils.asciiToHex('UniswapV2')
    );
    this.router = await IUniswapV2Router.at(UNISWAPV2_ROUTER02);
    this.proxy = await Proxy.new(this.registry.address);

    impersonateAndInjectEther(hbtcProviderAddress);
  });

  beforeEach(async function() {
    id = await evmSnapshot();
  });

  afterEach(async function() {
    await evmRevert(id);
  });

  describe('Ether to Token', function() {
    const tokenAddress = DAI_TOKEN;

    let balanceUser;
    let balanceProxy;
    let tokenUser;

    before(async function() {
      this.token = await IToken.at(tokenAddress);
    });

    beforeEach(async function() {
      balanceUser = await tracker(user);
      balanceProxy = await tracker(this.proxy.address);
      tokenUser = await this.token.balanceOf.call(user);
    });

    describe('Exact input', function() {
      it('normal', async function() {
        const value = ether('1');
        const to = this.hUniswapV2.address;
        const path = [WETH_TOKEN, tokenAddress];

        const result = await this.router.getAmountsOut.call(value, path, {
          from: user,
        });

        const data = abi.simpleEncode(
          'swapExactETHForTokens(uint256,uint256,address[]):(uint256[])',
          value,
          mulPercent(result, new BN('100').sub(slippage)),
          path
        );

        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: value,
        });

        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );
        expect(handlerReturn).to.be.bignumber.eq(result[result.length - 1]);

        expect(await this.token.balanceOf.call(user)).to.be.bignumber.eq(
          tokenUser.add(result[result.length - 1])
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
        const to = this.hUniswapV2.address;
        const path = [WETH_TOKEN, tokenAddress];

        const result = await this.router.getAmountsOut.call(value, path, {
          from: user,
        });

        const data = abi.simpleEncode(
          'swapExactETHForTokens(uint256,uint256,address[]):(uint256[])',
          MAX_UINT256,
          mulPercent(result, new BN('100').sub(slippage)),
          path
        );

        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: value,
        });

        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );
        expect(handlerReturn).to.be.bignumber.eq(result[result.length - 1]);

        expect(await this.token.balanceOf.call(user)).to.be.bignumber.eq(
          tokenUser.add(result[result.length - 1])
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
        const to = this.hUniswapV2.address;
        const path = [WETH_TOKEN, tokenAddress];
        const result = await this.router.getAmountsOut.call(value, path, {
          from: user,
        });
        const data = abi.simpleEncode(
          'swapExactETHForTokens(uint256,uint256,address[]):(uint256[])',
          value,
          result[result.length - 1].add(ether('0.1')),
          path
        );

        await expectRevert(
          this.proxy.execMock(to, data, { from: user, value: value }),
          'HUniswapV2_swapExactETHForTokens: UniswapV2Router: INSUFFICIENT_OUTPUT_AMOUNT'
        );
        expect(await this.token.balanceOf.call(user)).to.be.bignumber.eq(
          tokenUser
        );
        expect(
          await this.token.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.eq(ether('0'));
        expect(await balanceProxy.delta()).to.be.bignumber.eq(ether('0'));
      });

      it('invalid path', async function() {
        const value = ether('1');
        const to = this.hUniswapV2.address;
        const path = [tokenAddress, WETH_TOKEN];
        const data = abi.simpleEncode(
          'swapExactETHForTokens(uint256,uint256,address[]):(uint256[])',
          value,
          new BN('1'),
          path
        );
        await expectRevert(
          this.proxy.execMock(to, data, { from: user, value: value }),
          'HUniswapV2_swapExactETHForTokens: UniswapV2Router: INVALID_PATH'
        );
      });
    });

    describe('Exact output', function() {
      it('normal', async function() {
        const value = ether('1');
        const buyAmt = ether('100');
        const to = this.hUniswapV2.address;
        const path = [WETH_TOKEN, tokenAddress];
        const result = await this.router.getAmountsIn.call(buyAmt, path, {
          from: user,
        });
        const data = abi.simpleEncode(
          'swapETHForExactTokens(uint256,uint256,address[]):(uint256[])',
          mulPercent(result[0], new BN('100').add(slippage)),
          buyAmt,
          path
        );
        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: value,
        });

        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );
        const userBalanceDelta = await balanceUser.delta();

        expect(userBalanceDelta).to.be.bignumber.eq(
          ether('0')
            .sub(handlerReturn)
            .sub(new BN(receipt.receipt.gasUsed))
        );

        expect(await this.token.balanceOf.call(user)).to.be.bignumber.eq(
          tokenUser.add(buyAmt)
        );
        expect(
          await this.token.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.eq(ether('0'));
        expect(await balanceProxy.delta()).to.be.bignumber.eq(ether('0'));
        expect(userBalanceDelta).to.be.bignumber.eq(
          ether('0')
            .sub(result[0])
            .sub(new BN(receipt.receipt.gasUsed))
        );
        profileGas(receipt);
      });

      it('max amount', async function() {
        const value = ether('1');
        const buyAmt = ether('100');
        const to = this.hUniswapV2.address;
        const path = [WETH_TOKEN, tokenAddress];
        const result = await this.router.getAmountsIn.call(buyAmt, path, {
          from: user,
        });
        const data = abi.simpleEncode(
          'swapETHForExactTokens(uint256,uint256,address[]):(uint256[])',
          MAX_UINT256,
          buyAmt,
          path
        );
        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: value,
        });

        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );
        const userBalanceDelta = await balanceUser.delta();

        expect(userBalanceDelta).to.be.bignumber.eq(
          ether('0')
            .sub(handlerReturn)
            .sub(new BN(receipt.receipt.gasUsed))
        );

        expect(await this.token.balanceOf.call(user)).to.be.bignumber.eq(
          tokenUser.add(buyAmt)
        );
        expect(
          await this.token.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.eq(ether('0'));
        expect(await balanceProxy.delta()).to.be.bignumber.eq(ether('0'));
        expect(userBalanceDelta).to.be.bignumber.eq(
          ether('0')
            .sub(result[0])
            .sub(new BN(receipt.receipt.gasUsed))
        );
        profileGas(receipt);
      });

      it('insufficient ether', async function() {
        const buyAmt = ether('100');
        const to = this.hUniswapV2.address;
        const path = [WETH_TOKEN, tokenAddress];
        const result = await this.router.getAmountsIn.call(buyAmt, path, {
          from: user,
        });
        const value = result[0].sub(ether('0.01'));
        const data = abi.simpleEncode(
          'swapETHForExactTokens(uint256,uint256,address[]):(uint256[])',
          value,
          buyAmt,
          path
        );
        await expectRevert(
          this.proxy.execMock(to, data, {
            from: user,
            value: value,
          }),
          'HUniswapV2_swapETHForExactTokens: UniswapV2Router: EXCESSIVE_INPUT_AMOUNT'
        );
      });

      it('invalid path', async function() {
        const value = ether('1');
        const buyAmt = ether('100');
        const to = this.hUniswapV2.address;
        const path = [tokenAddress, WETH_TOKEN];
        const data = abi.simpleEncode(
          'swapETHForExactTokens(uint256,uint256,address[]):(uint256[])',
          value,
          buyAmt,
          path
        );
        await expectRevert(
          this.proxy.execMock(to, data, {
            from: user,
            value: value,
          }),
          'HUniswapV2_swapETHForExactTokens: UniswapV2Router: INVALID_PATH'
        );
      });
    });
  });

  describe('Token to Ether', function() {
    const tokenAddress = DAI_TOKEN;

    let balanceUser;
    let balanceProxy;
    let tokenUser;
    let providerAddress;

    before(async function() {
      providerAddress = await tokenProviderSushi(tokenAddress);

      this.token = await IToken.at(tokenAddress);
      this.hbtc = await IToken.at(HBTC_TOKEN);
      this.omg = await IToken.at(OMG_TOKEN);
      this.usdt = await IUsdt.at(USDT_TOKEN);
    });

    beforeEach(async function() {
      balanceUser = await tracker(user);
      balanceProxy = await tracker(this.proxy.address);
      tokenUser = await this.token.balanceOf(user);
    });

    describe('Exact input', function() {
      it('normal', async function() {
        const value = ether('100');
        const to = this.hUniswapV2.address;
        const path = [tokenAddress, WETH_TOKEN];
        const result = await this.router.getAmountsOut.call(value, path, {
          from: someone,
        });
        const data = abi.simpleEncode(
          'swapExactTokensForETH(uint256,uint256,address[]):(uint256[])',
          value,
          mulPercent(result, new BN('100').sub(slippage)),
          path
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
          ether('0')
            .add(handlerReturn)
            .sub(new BN(receipt.receipt.gasUsed))
        );

        expect(await this.token.balanceOf.call(user)).to.be.bignumber.eq(
          tokenUser
        );
        expect(
          await this.token.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.eq(ether('0'));
        expect(await balanceProxy.delta()).to.be.bignumber.eq(ether('0'));
        expect(userBalanceDelta).to.be.bignumber.eq(
          ether('0')
            .add(result[result.length - 1])
            .sub(new BN(receipt.receipt.gasUsed))
        );
        profileGas(receipt);
      });

      it('HBTC', async function() {
        const value = ether('1');
        const to = this.hUniswapV2.address;
        const path = [HBTC_TOKEN, WETH_TOKEN];
        const result = await this.router.getAmountsOut.call(value, path, {
          from: someone,
        });
        const data = abi.simpleEncode(
          'swapExactTokensForETH(uint256,uint256,address[]):(uint256[])',
          value,
          mulPercent(result, new BN('100').sub(slippage)),
          path
        );
        await this.hbtc.transfer(this.proxy.address, value, {
          from: hbtcProviderAddress,
        });
        await this.proxy.updateTokenMock(this.hbtc.address);
        await this.hbtc.transfer(someone, value, { from: hbtcProviderAddress });
        tokenUser = await this.hbtc.balanceOf.call(user);
        const receipt = await this.proxy.execMock(to, data, { from: user });

        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );
        const userBalanceDelta = await balanceUser.delta();

        expect(userBalanceDelta).to.be.bignumber.eq(
          ether('0')
            .add(handlerReturn)
            .sub(new BN(receipt.receipt.gasUsed))
        );

        expect(await this.hbtc.balanceOf.call(user)).to.be.bignumber.eq(
          tokenUser
        );
        expect(
          await this.hbtc.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.eq(ether('0'));
        expect(await balanceProxy.delta()).to.be.bignumber.eq(ether('0'));
        expect(userBalanceDelta).to.be.bignumber.eq(
          ether('0')
            .add(result[result.length - 1])
            .sub(new BN(receipt.receipt.gasUsed))
        );
        profileGas(receipt);
      });

      it('OMG', async function() {
        const value = ether('10');
        const to = this.hUniswapV2.address;
        const path = [OMG_TOKEN, WETH_TOKEN];
        const result = await this.router.getAmountsOut.call(value, path, {
          from: someone,
        });
        const data = abi.simpleEncode(
          'swapExactTokensForETH(uint256,uint256,address[]):(uint256[])',
          value,
          mulPercent(result, new BN('100').sub(slippage)),
          path
        );
        await this.omg.transfer(this.proxy.address, value, {
          from: omgProviderAddress,
        });
        await this.proxy.updateTokenMock(this.omg.address);
        await this.omg.transfer(someone, value, { from: omgProviderAddress });
        tokenUser = await this.omg.balanceOf.call(user);
        const receipt = await this.proxy.execMock(to, data, { from: user });

        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );
        const userBalanceDelta = await balanceUser.delta();

        expect(userBalanceDelta).to.be.bignumber.eq(
          ether('0')
            .add(handlerReturn)
            .sub(new BN(receipt.receipt.gasUsed))
        );

        expect(await this.omg.balanceOf.call(user)).to.be.bignumber.eq(
          tokenUser
        );
        expect(
          await this.omg.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.eq(ether('0'));
        expect(await balanceProxy.delta()).to.be.bignumber.eq(ether('0'));
        expect(userBalanceDelta).to.be.bignumber.eq(
          ether('0')
            .add(result[result.length - 1])
            .sub(new BN(receipt.receipt.gasUsed))
        );
        profileGas(receipt);
      });

      it('USDT', async function() {
        const value = new BN('1000000');
        const to = this.hUniswapV2.address;
        const path = [USDT_TOKEN, WETH_TOKEN];
        const result = await this.router.getAmountsOut.call(value, path, {
          from: someone,
        });
        const data = abi.simpleEncode(
          'swapExactTokensForETH(uint256,uint256,address[]):(uint256[])',
          value,
          mulPercent(result, new BN('100').sub(slippage)),
          path
        );

        await this.usdt.transfer(this.proxy.address, value, {
          from: usdtProviderAddress,
        });
        await this.proxy.updateTokenMock(this.usdt.address);
        await this.usdt.transfer(someone, value, { from: usdtProviderAddress });
        tokenUser = await this.usdt.balanceOf.call(user);
        const receipt = await this.proxy.execMock(to, data, { from: user });

        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );
        const userBalanceDelta = await balanceUser.delta();

        expect(userBalanceDelta).to.be.bignumber.eq(
          ether('0')
            .add(handlerReturn)
            .sub(new BN(receipt.receipt.gasUsed))
        );

        expect(await this.usdt.balanceOf.call(user)).to.be.bignumber.eq(
          tokenUser
        );
        expect(
          await this.usdt.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.eq(ether('0'));
        expect(await balanceProxy.delta()).to.be.bignumber.eq(ether('0'));
        expect(userBalanceDelta).to.be.bignumber.eq(
          ether('0')
            .add(result[result.length - 1])
            .sub(new BN(receipt.receipt.gasUsed))
        );
        profileGas(receipt);
      });

      it('max amount', async function() {
        const value = ether('100');
        const to = this.hUniswapV2.address;
        const path = [tokenAddress, WETH_TOKEN];
        const result = await this.router.getAmountsOut.call(value, path, {
          from: someone,
        });
        const data = abi.simpleEncode(
          'swapExactTokensForETH(uint256,uint256,address[]):(uint256[])',
          MAX_UINT256,
          mulPercent(result, new BN('100').sub(slippage)),
          path
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
          ether('0')
            .add(handlerReturn)
            .sub(new BN(receipt.receipt.gasUsed))
        );

        expect(await this.token.balanceOf.call(user)).to.be.bignumber.eq(
          tokenUser
        );
        expect(
          await this.token.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.eq(ether('0'));
        expect(await balanceProxy.delta()).to.be.bignumber.eq(ether('0'));
        expect(userBalanceDelta).to.be.bignumber.eq(
          ether('0')
            .add(result[result.length - 1])
            .sub(new BN(receipt.receipt.gasUsed))
        );
        profileGas(receipt);
      });

      it('min output too high', async function() {
        const value = ether('100');
        const to = this.hUniswapV2.address;
        const path = [tokenAddress, WETH_TOKEN];
        await this.token.transfer(this.proxy.address, value, {
          from: providerAddress,
        });
        await this.proxy.updateTokenMock(this.token.address);
        const result = await this.router.getAmountsOut.call(value, path, {
          from: someone,
        });
        const data = abi.simpleEncode(
          'swapExactTokensForETH(uint256,uint256,address[]):(uint256[])',
          value,
          result[result.length - 1].add(ether('0.1')),
          path
        );
        await expectRevert(
          this.proxy.execMock(to, data, { from: user }),
          'HUniswapV2_swapExactTokensForETH: UniswapV2Router: INSUFFICIENT_OUTPUT_AMOUNT'
        );
      });

      it('invalid path', async function() {
        const value = ether('100');
        const to = this.hUniswapV2.address;
        const path = [tokenAddress, WETH_TOKEN, tokenAddress];
        const data = abi.simpleEncode(
          'swapExactTokensForETH(uint256,uint256,address[]):(uint256[])',
          value,
          new BN('1'),
          path
        );
        await this.token.transfer(this.proxy.address, value, {
          from: providerAddress,
        });
        await this.proxy.updateTokenMock(this.token.address);
        await expectRevert(
          this.proxy.execMock(to, data, { from: user }),
          'HUniswapV2_swapExactTokensForETH: UniswapV2Router: INVALID_PATH'
        );
      });
    });

    describe('Exact output', function() {
      it('normal', async function() {
        const value = ether('1000');
        const buyAmt = ether('0.1');
        const to = this.hUniswapV2.address;
        const path = [tokenAddress, WETH_TOKEN];
        const result = await this.router.getAmountsIn.call(buyAmt, path, {
          from: someone,
        });
        const data = abi.simpleEncode(
          'swapTokensForExactETH(uint256,uint256,address[]):(uint256[])',
          buyAmt,
          mulPercent(result[0], new BN('100').add(slippage)),
          path
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
        const userBalanceDelta = await balanceUser.delta();
        expect(handlerReturn).to.be.bignumber.eq(result[0]);
        expect(await this.token.balanceOf.call(user)).to.be.bignumber.eq(
          tokenUser.add(value).sub(result[0])
        );
        expect(
          await this.token.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.eq(ether('0'));
        expect(await balanceProxy.delta()).to.be.bignumber.eq(ether('0'));
        expect(userBalanceDelta).to.be.bignumber.eq(
          buyAmt.sub(new BN(receipt.receipt.gasUsed))
        );
        profileGas(receipt);
      });

      it('HBTC', async function() {
        const value = ether('1');
        const buyAmt = ether('0.1');
        const to = this.hUniswapV2.address;
        const path = [HBTC_TOKEN, WETH_TOKEN];
        const result = await this.router.getAmountsIn.call(buyAmt, path, {
          from: someone,
        });

        const data = abi.simpleEncode(
          'swapTokensForExactETH(uint256,uint256,address[]):(uint256[])',
          buyAmt,
          mulPercent(result[0], new BN('100').add(slippage)),
          path
        );
        await this.hbtc.transfer(this.proxy.address, value, {
          from: hbtcProviderAddress,
        });
        await this.proxy.updateTokenMock(this.hbtc.address);
        await this.hbtc.transfer(someone, value, { from: hbtcProviderAddress });
        tokenUser = await this.hbtc.balanceOf.call(user);
        const receipt = await this.proxy.execMock(to, data, {
          from: user,
        });
        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );
        const userBalanceDelta = await balanceUser.delta();
        expect(handlerReturn).to.be.bignumber.eq(result[0]);
        expect(await this.hbtc.balanceOf.call(user)).to.be.bignumber.eq(
          tokenUser.add(value).sub(result[0])
        );
        expect(
          await this.hbtc.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.eq(ether('0'));
        expect(await balanceProxy.delta()).to.be.bignumber.eq(ether('0'));
        expect(userBalanceDelta).to.be.bignumber.eq(
          buyAmt.sub(new BN(receipt.receipt.gasUsed))
        );
        profileGas(receipt);
      });

      it('OMG', async function() {
        const value = ether('1000');
        const buyAmt = ether('0.1');
        const to = this.hUniswapV2.address;
        const path = [OMG_TOKEN, WETH_TOKEN];
        const result = await this.router.getAmountsIn.call(buyAmt, path, {
          from: someone,
        });
        const data = abi.simpleEncode(
          'swapTokensForExactETH(uint256,uint256,address[]):(uint256[])',
          buyAmt,
          mulPercent(result[0], new BN('100').add(slippage)),
          path
        );
        await this.omg.transfer(this.proxy.address, value, {
          from: omgProviderAddress,
        });
        await this.proxy.updateTokenMock(this.omg.address);
        await this.omg.transfer(someone, value, { from: omgProviderAddress });
        tokenUser = await this.omg.balanceOf.call(user);
        const receipt = await this.proxy.execMock(to, data, {
          from: user,
        });
        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );
        const userBalanceDelta = await balanceUser.delta();
        expect(handlerReturn).to.be.bignumber.eq(result[0]);
        expect(await this.omg.balanceOf.call(user)).to.be.bignumber.eq(
          tokenUser.add(value).sub(result[0])
        );
        expect(
          await this.omg.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.eq(ether('0'));
        expect(await balanceProxy.delta()).to.be.bignumber.eq(ether('0'));
        expect(userBalanceDelta).to.be.bignumber.eq(
          buyAmt.sub(new BN(receipt.receipt.gasUsed))
        );
        profileGas(receipt);
      });

      it('USDT', async function() {
        const value = new BN('10000000000');
        const buyAmt = ether('0.1');
        const to = this.hUniswapV2.address;
        const path = [USDT_TOKEN, WETH_TOKEN];
        const result = await this.router.getAmountsIn.call(buyAmt, path, {
          from: someone,
        });
        const data = abi.simpleEncode(
          'swapTokensForExactETH(uint256,uint256,address[]):(uint256[])',
          buyAmt,
          mulPercent(result[0], new BN('100').add(slippage)),
          path
        );
        await this.usdt.transfer(this.proxy.address, value, {
          from: usdtProviderAddress,
        });
        await this.proxy.updateTokenMock(this.usdt.address);
        await this.usdt.transfer(someone, value, { from: usdtProviderAddress });
        tokenUser = await this.usdt.balanceOf.call(user);
        const receipt = await this.proxy.execMock(to, data, {
          from: user,
        });
        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );
        const userBalanceDelta = await balanceUser.delta();
        expect(handlerReturn).to.be.bignumber.eq(result[0]);
        expect(await this.usdt.balanceOf.call(user)).to.be.bignumber.eq(
          tokenUser.add(value).sub(result[0])
        );
        expect(
          await this.usdt.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.eq(ether('0'));
        expect(await balanceProxy.delta()).to.be.bignumber.eq(ether('0'));
        expect(userBalanceDelta).to.be.bignumber.eq(
          buyAmt.sub(new BN(receipt.receipt.gasUsed))
        );
        profileGas(receipt);
      });

      it('allowance is not zero', async function() {
        const value = ether('1000');
        const buyAmt = ether('0.1');
        const to = this.hUniswapV2.address;
        const path = [OMG_TOKEN, WETH_TOKEN];
        const data1 = abi.simpleEncode(
          'swapTokensForExactETH(uint256,uint256,address[]):(uint256[])',
          buyAmt,
          value,
          path
        );

        // First swap to make allowance > 0
        await this.omg.transfer(this.proxy.address, value, {
          from: omgProviderAddress,
        });
        await this.proxy.updateTokenMock(this.omg.address);
        await this.omg.transfer(someone, value, { from: omgProviderAddress });
        await this.proxy.execMock(to, data1, {
          from: user,
        });
        expect(
          await this.omg.allowance.call(this.proxy.address, UNISWAPV2_ROUTER02)
        ).to.be.bignumber.gt(ether('0'));

        // Second swap in allowance > 0
        const result = await this.router.getAmountsIn.call(buyAmt, path, {
          from: someone,
        });
        const data2 = abi.simpleEncode(
          'swapTokensForExactETH(uint256,uint256,address[]):(uint256[])',
          buyAmt,
          mulPercent(result[0], new BN('100').add(slippage)),
          path
        );
        await this.omg.transfer(this.proxy.address, value, {
          from: omgProviderAddress,
        });
        await this.proxy.updateTokenMock(this.omg.address);
        await this.omg.transfer(someone, value, { from: omgProviderAddress });
        balanceUser.get();
        tokenUser = await this.omg.balanceOf.call(user);
        const receipt = await this.proxy.execMock(to, data2, {
          from: user,
        });

        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );
        const userBalanceDelta = await balanceUser.delta();
        expect(handlerReturn).to.be.bignumber.eq(result[0]);
        expect(await this.omg.balanceOf.call(user)).to.be.bignumber.eq(
          tokenUser.add(value).sub(result[0])
        );
        expect(
          await this.omg.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.eq(ether('0'));
        expect(await balanceProxy.delta()).to.be.bignumber.eq(ether('0'));
        expect(userBalanceDelta).to.be.bignumber.eq(
          buyAmt.sub(new BN(receipt.receipt.gasUsed))
        );
        profileGas(receipt);
      });

      it('max amount', async function() {
        const value = ether('1000');
        const buyAmt = ether('0.1');
        const to = this.hUniswapV2.address;
        const path = [tokenAddress, WETH_TOKEN];
        const result = await this.router.getAmountsIn.call(buyAmt, path, {
          from: someone,
        });
        const data = abi.simpleEncode(
          'swapTokensForExactETH(uint256,uint256,address[]):(uint256[])',
          buyAmt,
          MAX_UINT256,
          path
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
        const userBalanceDelta = await balanceUser.delta();
        expect(handlerReturn).to.be.bignumber.eq(result[0]);
        expect(await this.token.balanceOf.call(user)).to.be.bignumber.eq(
          tokenUser.add(value).sub(result[0])
        );
        expect(
          await this.token.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.eq(ether('0'));
        expect(await balanceProxy.delta()).to.be.bignumber.eq(ether('0'));
        expect(userBalanceDelta).to.be.bignumber.eq(
          buyAmt.sub(new BN(receipt.receipt.gasUsed))
        );
        profileGas(receipt);
      });
      it('insufficient input token', async function() {
        const value = ether('1');
        const buyAmt = ether('100');
        const to = this.hUniswapV2.address;
        const path = [tokenAddress, WETH_TOKEN];
        const data = abi.simpleEncode(
          'swapTokensForExactETH(uint256,uint256,address[]):(uint256[])',
          buyAmt,
          value,
          path
        );
        await this.token.transfer(this.proxy.address, value, {
          from: providerAddress,
        });
        await this.proxy.updateTokenMock(this.token.address);
        await expectRevert(
          this.proxy.execMock(to, data, { from: user }),
          'HUniswapV2_swapTokensForExactETH: UniswapV2Router: EXCESSIVE_INPUT_AMOUNT'
        );
      });
      it('invalid path', async function() {
        const value = ether('1000');
        const buyAmt = ether('0.1');
        const to = this.hUniswapV2.address;
        const path = [tokenAddress, WETH_TOKEN, tokenAddress];
        const data = abi.simpleEncode(
          'swapTokensForExactETH(uint256,uint256,address[]):(uint256[])',
          buyAmt,
          value,
          path
        );
        await this.token.transfer(this.proxy.address, value, {
          from: providerAddress,
        });
        await this.proxy.updateTokenMock(this.token.address);
        await expectRevert(
          this.proxy.execMock(to, data, { from: user }),
          'HUniswapV2_swapTokensForExactETH: UniswapV2Router: INVALID_PATH'
        );
      });
    });
  });

  describe('Token to Token', function() {
    const token0Address = DAI_TOKEN;
    const token1Address = BAT_TOKEN;

    let token0User;
    let token1User;
    let providerAddress;

    before(async function() {
      providerAddress = await tokenProviderSushi(token0Address);

      this.token0 = await IToken.at(token0Address);
      this.token1 = await IToken.at(token1Address);

      this.hbtc = await IToken.at(HBTC_TOKEN);
      this.omg = await IToken.at(OMG_TOKEN);
      this.usdt = await IUsdt.at(USDT_TOKEN);
    });

    beforeEach(async function() {
      token0User = await this.token0.balanceOf.call(user);
      token1User = await this.token1.balanceOf.call(user);
    });

    describe('Exact input', function() {
      it('normal', async function() {
        const value = ether('100');
        const to = this.hUniswapV2.address;
        const path = [token0Address, WETH_TOKEN, token1Address];
        const result = await this.router.getAmountsOut.call(value, path, {
          from: someone,
        });
        const data = abi.simpleEncode(
          'swapExactTokensForTokens(uint256,uint256,address[]):(uint256[])',
          value,
          mulPercent(result, new BN('100').sub(slippage)),
          path
        );
        await this.token0.transfer(this.proxy.address, value, {
          from: providerAddress,
        });
        await this.proxy.updateTokenMock(this.token0.address);
        await this.token0.transfer(someone, value, {
          from: providerAddress,
        });
        const receipt = await this.proxy.execMock(to, data, { from: user });
        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );
        expect(handlerReturn).to.be.bignumber.eq(result[result.length - 1]);
        expect(await this.token0.balanceOf.call(user)).to.be.bignumber.eq(
          token0User
        );
        expect(
          await this.token0.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.eq(ether('0'));
        expect(
          await this.token1.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.eq(ether('0'));
        expect(await this.token1.balanceOf.call(user)).to.be.bignumber.eq(
          token1User.add(result[result.length - 1])
        );
        profileGas(receipt);
      });
      it('HBTC', async function() {
        const value = ether('1');
        const to = this.hUniswapV2.address;
        const path = [HBTC_TOKEN, WETH_TOKEN, token1Address];
        const result = await this.router.getAmountsOut.call(value, path, {
          from: someone,
        });
        const data = abi.simpleEncode(
          'swapExactTokensForTokens(uint256,uint256,address[]):(uint256[])',
          value,
          mulPercent(result, new BN('100').sub(slippage)),
          path
        );
        await this.hbtc.transfer(this.proxy.address, value, {
          from: hbtcProviderAddress,
        });
        await this.proxy.updateTokenMock(this.hbtc.address);
        await this.hbtc.transfer(someone, value, {
          from: hbtcProviderAddress,
        });
        token0User = await this.hbtc.balanceOf.call(user);
        const receipt = await this.proxy.execMock(to, data, { from: user });
        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );
        expect(handlerReturn).to.be.bignumber.eq(result[result.length - 1]);
        expect(await this.hbtc.balanceOf.call(user)).to.be.bignumber.eq(
          token0User
        );
        expect(
          await this.hbtc.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.eq(ether('0'));
        expect(
          await this.token1.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.eq(ether('0'));
        expect(await this.token1.balanceOf.call(user)).to.be.bignumber.eq(
          token1User.add(result[result.length - 1])
        );
        profileGas(receipt);
      });

      it('OMG', async function() {
        const value = ether('100');
        const to = this.hUniswapV2.address;
        const path = [OMG_TOKEN, WETH_TOKEN, token1Address];
        const result = await this.router.getAmountsOut.call(value, path, {
          from: someone,
        });
        const data = abi.simpleEncode(
          'swapExactTokensForTokens(uint256,uint256,address[]):(uint256[])',
          value,
          mulPercent(result, new BN('100').sub(slippage)),
          path
        );
        await this.omg.transfer(this.proxy.address, value, {
          from: omgProviderAddress,
        });
        await this.proxy.updateTokenMock(this.omg.address);
        await this.omg.transfer(someone, value, {
          from: omgProviderAddress,
        });
        token0User = await this.omg.balanceOf.call(user);
        const receipt = await this.proxy.execMock(to, data, { from: user });
        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );
        expect(handlerReturn).to.be.bignumber.eq(result[result.length - 1]);
        expect(await this.omg.balanceOf.call(user)).to.be.bignumber.eq(
          token0User
        );
        expect(
          await this.omg.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.eq(ether('0'));
        expect(
          await this.token1.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.eq(ether('0'));
        expect(await this.token1.balanceOf.call(user)).to.be.bignumber.eq(
          token1User.add(result[result.length - 1])
        );
        profileGas(receipt);
      });

      it('USDT', async function() {
        const value = new BN('1000000');
        const to = this.hUniswapV2.address;
        const path = [USDT_TOKEN, WETH_TOKEN, token1Address];
        const result = await this.router.getAmountsOut.call(value, path, {
          from: someone,
        });
        const data = abi.simpleEncode(
          'swapExactTokensForTokens(uint256,uint256,address[]):(uint256[])',
          value,
          mulPercent(result, new BN('100').sub(slippage)),
          path
        );
        await this.usdt.transfer(this.proxy.address, value, {
          from: usdtProviderAddress,
        });
        await this.proxy.updateTokenMock(this.usdt.address);
        await this.usdt.transfer(someone, value, {
          from: usdtProviderAddress,
        });
        token0User = await this.usdt.balanceOf.call(user);
        const receipt = await this.proxy.execMock(to, data, { from: user });
        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );
        expect(handlerReturn).to.be.bignumber.eq(result[result.length - 1]);
        expect(await this.usdt.balanceOf.call(user)).to.be.bignumber.eq(
          token0User
        );
        expect(
          await this.usdt.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.eq(ether('0'));
        expect(
          await this.token1.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.eq(ether('0'));
        expect(await this.token1.balanceOf.call(user)).to.be.bignumber.eq(
          token1User.add(result[result.length - 1])
        );
        profileGas(receipt);
      });

      it('max amount', async function() {
        const value = ether('100');
        const to = this.hUniswapV2.address;
        const path = [token0Address, WETH_TOKEN, token1Address];
        const result = await this.router.getAmountsOut.call(value, path, {
          from: someone,
        });
        const data = abi.simpleEncode(
          'swapExactTokensForTokens(uint256,uint256,address[]):(uint256[])',
          MAX_UINT256,
          mulPercent(result, new BN('100').sub(slippage)),
          path
        );
        await this.token0.transfer(this.proxy.address, value, {
          from: providerAddress,
        });
        await this.proxy.updateTokenMock(this.token0.address);
        await this.token0.transfer(someone, value, {
          from: providerAddress,
        });
        const receipt = await this.proxy.execMock(to, data, { from: user });
        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );
        expect(handlerReturn).to.be.bignumber.eq(result[result.length - 1]);
        expect(await this.token0.balanceOf.call(user)).to.be.bignumber.eq(
          token0User
        );
        expect(
          await this.token0.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.eq(ether('0'));
        expect(
          await this.token1.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.eq(ether('0'));
        expect(await this.token1.balanceOf.call(user)).to.be.bignumber.eq(
          token1User.add(result[result.length - 1])
        );
        profileGas(receipt);
      });

      it('min output too high', async function() {
        const value = ether('100');
        const to = this.hUniswapV2.address;
        const path = [token0Address, WETH_TOKEN, token1Address];
        await this.token0.transfer(this.proxy.address, value, {
          from: providerAddress,
        });
        await this.proxy.updateTokenMock(this.token0.address);
        await this.token0.transfer(someone, value, {
          from: providerAddress,
        });
        const result = await this.router.getAmountsOut.call(value, path, {
          from: someone,
        });
        const data = abi.simpleEncode(
          'swapExactTokensForTokens(uint256,uint256,address[]):(uint256[])',
          value,
          result[result.length - 1].add(ether('10')),
          path
        );
        await expectRevert(
          this.proxy.execMock(to, data, { from: user }),
          'HUniswapV2_swapExactTokensForTokens: UniswapV2Router: INSUFFICIENT_OUTPUT_AMOUNT'
        );
      });
      it('identical addresses', async function() {
        const value = ether('100');
        const to = this.hUniswapV2.address;
        const path = [token0Address, token0Address, token1Address];
        const data = abi.simpleEncode(
          'swapExactTokensForTokens(uint256,uint256,address[]):(uint256[])',
          value,
          new BN('1'),
          path
        );
        await this.token0.transfer(this.proxy.address, value, {
          from: providerAddress,
        });
        await this.proxy.updateTokenMock(this.token0.address);
        await expectRevert(
          this.proxy.execMock(to, data, { from: user }),
          'HUniswapV2_swapExactTokensForTokens: UniswapV2Library: IDENTICAL_ADDRESSES'
        );
      });
    });

    describe('Exact output', function() {
      it('normal', async function() {
        const value = ether('100');
        const buyAmt = ether('1');
        const to = this.hUniswapV2.address;
        const path = [token0Address, WETH_TOKEN, token1Address];
        const result = await this.router.getAmountsIn.call(buyAmt, path, {
          from: someone,
        });
        const data = abi.simpleEncode(
          'swapTokensForExactTokens(uint256,uint256,address[]):(uint256[])',
          buyAmt,
          mulPercent(result[0], new BN('100').add(slippage)),
          path
        );
        await this.token0.transfer(this.proxy.address, value, {
          from: providerAddress,
        });
        await this.proxy.updateTokenMock(this.token0.address);
        await this.token0.transfer(someone, value, {
          from: providerAddress,
        });
        const receipt = await this.proxy.execMock(to, data, {
          from: user,
        });

        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );
        expect(handlerReturn).to.be.bignumber.eq(result[0]);

        expect(await this.token0.balanceOf.call(user)).to.be.bignumber.eq(
          token0User.add(value).sub(result[0])
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

      it('HBTC', async function() {
        const value = ether('1');
        const buyAmt = ether('1');
        const to = this.hUniswapV2.address;
        const path = [HBTC_TOKEN, WETH_TOKEN, token1Address];
        const result = await this.router.getAmountsIn.call(buyAmt, path, {
          from: someone,
        });
        const data = abi.simpleEncode(
          'swapTokensForExactTokens(uint256,uint256,address[]):(uint256[])',
          buyAmt,
          mulPercent(result[0], new BN('100').add(slippage)),
          path
        );
        await this.hbtc.transfer(this.proxy.address, value, {
          from: hbtcProviderAddress,
        });
        await this.proxy.updateTokenMock(this.hbtc.address);
        await this.hbtc.transfer(someone, value, {
          from: hbtcProviderAddress,
        });
        token0User = await this.hbtc.balanceOf.call(user);
        const receipt = await this.proxy.execMock(to, data, {
          from: user,
        });

        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );
        expect(handlerReturn).to.be.bignumber.eq(result[0]);

        expect(await this.hbtc.balanceOf.call(user)).to.be.bignumber.eq(
          token0User.add(value).sub(result[0])
        );
        expect(
          await this.hbtc.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.eq(ether('0'));
        expect(
          await this.token1.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.eq(ether('0'));
        expect(await this.token1.balanceOf.call(user)).to.be.bignumber.eq(
          token1User.add(buyAmt)
        );
        profileGas(receipt);
      });

      it('OMG', async function() {
        const value = ether('100');
        const buyAmt = ether('1');
        const to = this.hUniswapV2.address;
        const path = [OMG_TOKEN, WETH_TOKEN, token1Address];
        const result = await this.router.getAmountsIn.call(buyAmt, path, {
          from: someone,
        });
        const data = abi.simpleEncode(
          'swapTokensForExactTokens(uint256,uint256,address[]):(uint256[])',
          buyAmt,
          mulPercent(result[0], new BN('100').add(slippage)),
          path
        );
        await this.omg.transfer(this.proxy.address, value, {
          from: omgProviderAddress,
        });
        await this.proxy.updateTokenMock(this.omg.address);
        await this.omg.transfer(someone, value, {
          from: omgProviderAddress,
        });
        token0User = await this.omg.balanceOf.call(user);
        const receipt = await this.proxy.execMock(to, data, {
          from: user,
        });

        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );
        expect(handlerReturn).to.be.bignumber.eq(result[0]);

        expect(await this.omg.balanceOf.call(user)).to.be.bignumber.eq(
          token0User.add(value).sub(result[0])
        );
        expect(
          await this.omg.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.eq(ether('0'));
        expect(
          await this.token1.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.eq(ether('0'));
        expect(await this.token1.balanceOf.call(user)).to.be.bignumber.eq(
          token1User.add(buyAmt)
        );
        profileGas(receipt);
      });

      it('USDT', async function() {
        const value = new BN('100000000');
        const buyAmt = ether('1');
        const to = this.hUniswapV2.address;
        const path = [USDT_TOKEN, WETH_TOKEN, token1Address];
        const result = await this.router.getAmountsIn.call(buyAmt, path, {
          from: someone,
        });
        const data = abi.simpleEncode(
          'swapTokensForExactTokens(uint256,uint256,address[]):(uint256[])',
          buyAmt,
          mulPercent(result[0], new BN('100').add(slippage)),
          path
        );
        await this.usdt.transfer(this.proxy.address, value, {
          from: usdtProviderAddress,
        });
        await this.proxy.updateTokenMock(this.usdt.address);
        await this.usdt.transfer(someone, value, {
          from: usdtProviderAddress,
        });
        token0User = await this.usdt.balanceOf.call(user);
        const receipt = await this.proxy.execMock(to, data, {
          from: user,
        });

        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );
        expect(handlerReturn).to.be.bignumber.eq(result[0]);

        expect(await this.usdt.balanceOf.call(user)).to.be.bignumber.eq(
          token0User.add(value).sub(result[0])
        );
        expect(
          await this.usdt.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.eq(ether('0'));
        expect(
          await this.token1.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.eq(ether('0'));
        expect(await this.token1.balanceOf.call(user)).to.be.bignumber.eq(
          token1User.add(buyAmt)
        );
        profileGas(receipt);
      });

      it('allowance is not zero', async function() {
        const value = ether('100');
        const buyAmt = ether('1');
        const to = this.hUniswapV2.address;
        const path = [OMG_TOKEN, WETH_TOKEN, token1Address];

        // First Swap to make allowance > 0
        const data1 = abi.simpleEncode(
          'swapTokensForExactTokens(uint256,uint256,address[]):(uint256[])',
          buyAmt,
          value,
          path
        );
        await this.omg.transfer(this.proxy.address, value, {
          from: omgProviderAddress,
        });
        await this.proxy.updateTokenMock(this.omg.address);
        await this.omg.transfer(someone, value, {
          from: omgProviderAddress,
        });
        await this.proxy.execMock(to, data1, {
          from: user,
        });
        expect(
          await this.omg.allowance.call(this.proxy.address, UNISWAPV2_ROUTER02)
        ).to.be.bignumber.gt(new BN(0));

        // Second Swap
        const result = await this.router.getAmountsIn.call(buyAmt, path, {
          from: someone,
        });
        const data2 = abi.simpleEncode(
          'swapTokensForExactTokens(uint256,uint256,address[]):(uint256[])',
          buyAmt,
          mulPercent(result[0], new BN('100').add(slippage)),
          path
        );
        await this.omg.transfer(this.proxy.address, value, {
          from: omgProviderAddress,
        });
        await this.proxy.updateTokenMock(this.omg.address);
        await this.omg.transfer(someone, value, {
          from: omgProviderAddress,
        });
        token0User = await this.omg.balanceOf.call(user);
        const receipt = await this.proxy.execMock(to, data2, {
          from: user,
        });

        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );
        expect(handlerReturn).to.be.bignumber.eq(result[0]);

        expect(await this.omg.balanceOf.call(user)).to.be.bignumber.eq(
          token0User.add(value).sub(result[0])
        );
        expect(
          await this.omg.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.eq(ether('0'));
        expect(
          await this.token1.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.eq(ether('0'));
        expect(await this.token1.balanceOf.call(user)).to.be.bignumber.eq(
          token1User.add(buyAmt).add(buyAmt)
        );
        profileGas(receipt);
      });

      it('max amount', async function() {
        const value = ether('100');
        const buyAmt = ether('1');
        const to = this.hUniswapV2.address;
        const path = [token0Address, WETH_TOKEN, token1Address];
        const result = await this.router.getAmountsIn.call(buyAmt, path, {
          from: someone,
        });
        const data = abi.simpleEncode(
          'swapTokensForExactTokens(uint256,uint256,address[]):(uint256[])',
          buyAmt,
          MAX_UINT256,
          path
        );
        await this.token0.transfer(this.proxy.address, value, {
          from: providerAddress,
        });
        await this.proxy.updateTokenMock(this.token0.address);
        await this.token0.transfer(someone, value, {
          from: providerAddress,
        });
        const receipt = await this.proxy.execMock(to, data, {
          from: user,
        });

        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );
        expect(handlerReturn).to.be.bignumber.eq(result[0]);

        expect(await this.token0.balanceOf.call(user)).to.be.bignumber.eq(
          token0User.add(value).sub(result[0])
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

      it('excessive input amount', async function() {
        const value = ether('1');
        const buyAmt = ether('1000');
        const to = this.hUniswapV2.address;
        const path = [token0Address, WETH_TOKEN, token1Address];
        const data = abi.simpleEncode(
          'swapTokensForExactTokens(uint256,uint256,address[]):(uint256[])',
          buyAmt,
          value,
          path
        );
        await this.token0.transfer(this.proxy.address, value, {
          from: providerAddress,
        });
        await this.proxy.updateTokenMock(this.token0.address);
        await expectRevert(
          this.proxy.execMock(to, data, { from: user }),
          'HUniswapV2_swapTokensForExactTokens: UniswapV2Router: EXCESSIVE_INPUT_AMOUNT'
        );
      });

      it('identical addresses', async function() {
        const value = ether('100');
        const buyAmt = ether('1');
        const to = this.hUniswapV2.address;
        const path = [token0Address, WETH_TOKEN, WETH_TOKEN, token1Address];
        const data = abi.simpleEncode(
          'swapTokensForExactTokens(uint256,uint256,address[]):(uint256[])',
          buyAmt,
          value,
          path
        );
        await this.token0.transfer(this.proxy.address, value, {
          from: providerAddress,
        });
        await this.proxy.updateTokenMock(this.token0.address);
        await expectRevert(
          this.proxy.execMock(to, data, { from: user }),
          'HUniswapV2_swapTokensForExactTokens: UniswapV2Library: IDENTICAL_ADDRESSES'
        );
      });
    });
  });
});
