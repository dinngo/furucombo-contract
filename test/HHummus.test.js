if (network.config.chainId == 1088) {
  // This test supports to run on these chains.
} else {
  return;
}

const {
  BN,
  constants,
  ether,
  expectRevert,
} = require('@openzeppelin/test-helpers');

const { MAX_UINT256 } = constants;
const abi = require('ethereumjs-abi');
const utils = web3.utils;
const { expect } = require('chai');
const {
  DAI_TOKEN,
  USDC_TOKEN,
  MAI_TOKEN,
  HUMMUS_ROUTER01,
  HUMMUS_POOL_USDT_USDC_DAI,
  HUMMUS_POOL_USDC_MAI,
} = require('./utils/constants');
const {
  evmRevert,
  evmSnapshot,
  mulPercent,
  profileGas,
  getHandlerReturn,
  mwei,
  setTokenBalance,
  getBalanceSlotNum,
} = require('./utils/utils');

const HHummus = artifacts.require('HHummus');
const FeeRuleRegistry = artifacts.require('FeeRuleRegistry');
const Registry = artifacts.require('Registry');
const Proxy = artifacts.require('ProxyMock');
const IToken = artifacts.require('IERC20');
const IHummusRouter = artifacts.require('IHummusRouter01');

contract('Hummus Swap', function ([_, user]) {
  let id;
  const slippage = new BN('3');

  before(async function () {
    this.registry = await Registry.new();
    this.hHummus = await HHummus.new(HUMMUS_ROUTER01);
    await this.registry.register(
      this.hHummus.address,
      utils.asciiToHex('Hummus')
    );
    this.router = await IHummusRouter.at(HUMMUS_ROUTER01);
    this.feeRuleRegistry = await FeeRuleRegistry.new('0', _);
    this.proxy = await Proxy.new(
      this.registry.address,
      this.feeRuleRegistry.address
    );
  });

  beforeEach(async function () {
    id = await evmSnapshot();
  });

  afterEach(async function () {
    await evmRevert(id);
  });

  describe('Token to Token', function () {
    const token0Address = USDC_TOKEN;
    const token1Address = DAI_TOKEN;
    const altTokenAddress = MAI_TOKEN;
    const token0Symbol = 'USDC';
    const token1Symbol = 'DAI';

    let token0;
    let token1;
    let altToken;
    let token0User;
    let token1User;
    let pool;
    let altPool;

    before(async function () {
      token0 = await IToken.at(token0Address);
      token1 = await IToken.at(token1Address);
      altToken = await IToken.at(altTokenAddress);
      pool = HUMMUS_POOL_USDT_USDC_DAI;
      altPool = HUMMUS_POOL_USDC_MAI;
    });

    beforeEach(async function () {
      token0User = await token0.balanceOf.call(user);
      token1User = await token1.balanceOf.call(user);
      altTokenUser = await altToken.balanceOf.call(user);
    });

    describe('Exact input', function () {
      describe('single path', function () {
        it('main pool', async function () {
          const value = mwei('1000');
          const to = this.hHummus.address;
          const tokenPath = [token0.address, token1.address];
          const poolPath = [pool];

          const result = await this.router.quotePotentialSwaps.call(
            tokenPath,
            poolPath,
            value
          );
          const potentialOutcome = result[0];

          // Prepare call data
          const data = abi.simpleEncode(
            'swapTokensForTokens(uint256,uint256,address[],address[])',
            value,
            mulPercent(potentialOutcome, new BN('100').sub(slippage)),
            tokenPath,
            poolPath
          );

          // Execute
          await sendToken(token0Symbol, token0, this.proxy.address, value);
          await this.proxy.updateTokenMock(token0.address);
          const receipt = await this.proxy.execMock(to, data, { from: user });

          // Verify
          const handlerReturn = utils.toBN(
            getHandlerReturn(receipt, ['uint256'])[0]
          );

          expect(handlerReturn).to.be.bignumber.eq(potentialOutcome);

          // Verify proxy balance
          expect(
            await token0.balanceOf.call(this.proxy.address)
          ).to.be.bignumber.zero;
          expect(
            await token1.balanceOf.call(this.proxy.address)
          ).to.be.bignumber.zero;

          // Verify user balance
          expect(await token0.balanceOf.call(user)).to.be.bignumber.eq(
            token0User
          );
          expect(await token1.balanceOf.call(user)).to.be.bignumber.eq(
            token1User.add(potentialOutcome)
          );

          profileGas(receipt);
        });

        it('alt pool', async function () {
          const value = mwei('1000');
          const to = this.hHummus.address;
          const tokenPath = [token0.address, altToken.address];
          const poolPath = [altPool];

          const result = await this.router.quotePotentialSwaps.call(
            tokenPath,
            poolPath,
            value
          );
          const potentialOutcome = result[0];

          // Prepare call data
          const data = abi.simpleEncode(
            'swapTokensForTokens(uint256,uint256,address[],address[])',
            value,
            mulPercent(potentialOutcome, new BN('100').sub(slippage)),
            tokenPath,
            poolPath
          );

          // Execute
          await sendToken(token0Symbol, token0, this.proxy.address, value);
          await this.proxy.updateTokenMock(token0.address);
          const receipt = await this.proxy.execMock(to, data, { from: user });

          // Verify
          const handlerReturn = utils.toBN(
            getHandlerReturn(receipt, ['uint256'])[0]
          );

          expect(handlerReturn).to.be.bignumber.eq(potentialOutcome);

          // Verify proxy balance
          expect(
            await token0.balanceOf.call(this.proxy.address)
          ).to.be.bignumber.zero;
          expect(
            await altToken.balanceOf.call(this.proxy.address)
          ).to.be.bignumber.zero;

          // Verify user balance
          expect(await token0.balanceOf.call(user)).to.be.bignumber.eq(
            token0User
          );
          expect(await altToken.balanceOf.call(user)).to.be.bignumber.eq(
            altTokenUser.add(potentialOutcome)
          );

          profileGas(receipt);
        });

        it('multi-pools', async function () {
          const value = ether('10');
          const to = this.hHummus.address;
          const tokenPath = [token1.address, token0.address, altToken.address];
          const poolPath = [pool, altPool];

          const result = await this.router.quotePotentialSwaps.call(
            tokenPath,
            poolPath,
            value
          );
          const potentialOutcome = result[0];

          // Prepare call data
          const data = abi.simpleEncode(
            'swapTokensForTokens(uint256,uint256,address[],address[])',
            value,
            mulPercent(potentialOutcome, new BN('100').sub(slippage)),
            tokenPath,
            poolPath
          );

          // Execute
          await sendToken(token1Symbol, token1, this.proxy.address, value);
          await this.proxy.updateTokenMock(token0.address);
          const receipt = await this.proxy.execMock(to, data, { from: user });

          // Verify
          const handlerReturn = utils.toBN(
            getHandlerReturn(receipt, ['uint256'])[0]
          );

          expect(handlerReturn).to.be.bignumber.eq(potentialOutcome);

          // Verify proxy balance
          expect(
            await token0.balanceOf.call(this.proxy.address)
          ).to.be.bignumber.zero;
          expect(
            await token1.balanceOf.call(this.proxy.address)
          ).to.be.bignumber.zero;
          expect(
            await altToken.balanceOf.call(this.proxy.address)
          ).to.be.bignumber.zero;

          // Verify user balance
          expect(await token0.balanceOf.call(user)).to.be.bignumber.eq(
            token0User
          );
          // Verify user balance
          expect(await token1.balanceOf.call(user)).to.be.bignumber.eq(
            token1User
          );
          expect(await altToken.balanceOf.call(user)).to.be.bignumber.eq(
            altTokenUser.add(potentialOutcome)
          );

          profileGas(receipt);
        });

        it('max amount', async function () {
          const value = mwei('1000');
          const to = this.hHummus.address;
          const tokenPath = [token0.address, token1.address];
          const poolPath = [pool];

          const result = await this.router.quotePotentialSwaps.call(
            tokenPath,
            poolPath,
            value
          );
          const potentialOutcome = result[0];

          // Prepare call data
          const data = abi.simpleEncode(
            'swapTokensForTokens(uint256,uint256,address[],address[])',
            MAX_UINT256,
            mulPercent(potentialOutcome, new BN('100').sub(slippage)),
            tokenPath,
            poolPath
          );

          // Execute
          await sendToken(token0Symbol, token0, this.proxy.address, value);
          await this.proxy.updateTokenMock(token0.address);
          const receipt = await this.proxy.execMock(to, data, { from: user });

          // Verify
          const handlerReturn = utils.toBN(
            getHandlerReturn(receipt, ['uint256'])[0]
          );

          expect(handlerReturn).to.be.bignumber.eq(potentialOutcome);

          // Verify proxy balance
          expect(
            await token0.balanceOf.call(this.proxy.address)
          ).to.be.bignumber.zero;
          expect(
            await token1.balanceOf.call(this.proxy.address)
          ).to.be.bignumber.zero;

          // Verify user balance
          expect(await token0.balanceOf.call(user)).to.be.bignumber.eq(
            token0User
          );
          expect(await token1.balanceOf.call(user)).to.be.bignumber.eq(
            token1User.add(potentialOutcome)
          );

          profileGas(receipt);
        });

        it('should revert: invalid token path', async function () {
          const value = mwei('1000');
          const to = this.hHummus.address;
          const tokenPath = [token0.address];
          const poolPath = [altPool];

          // Prepare call data
          const data = abi.simpleEncode(
            'swapTokensForTokens(uint256,uint256,address[],address[])',
            value,
            0,
            tokenPath,
            poolPath
          );

          // Execute
          await sendToken(token0Symbol, token0, this.proxy.address, value);
          await this.proxy.updateTokenMock(token0.address);
          await expectRevert(
            this.proxy.execMock(to, data, { from: user }),
            '0_HHummus_swapTokensForTokens: invalid token path'
          );
        });

        it('should revert: invalid pool path', async function () {
          const value = mwei('1000');
          const to = this.hHummus.address;
          const tokenPath = [token0.address, token1.address];
          const poolPath = [];

          // Prepare call data
          const data = abi.simpleEncode(
            'swapTokensForTokens(uint256,uint256,address[],address[])',
            value,
            0,
            tokenPath,
            poolPath
          );

          // Execute
          await sendToken(token0Symbol, token0, this.proxy.address, value);
          await this.proxy.updateTokenMock(token0.address);
          await expectRevert(
            this.proxy.execMock(to, data, { from: user }),
            '0_HHummus_swapTokensForTokens: invalid pool path'
          );
        });

        it('should revert: wrong pool', async function () {
          const value = mwei('1000');
          const to = this.hHummus.address;
          const tokenPath = [token0.address, token1.address];
          const poolPath = [altPool];

          // Prepare call data
          const data = abi.simpleEncode(
            'swapTokensForTokens(uint256,uint256,address[],address[])',
            value,
            0,
            tokenPath,
            poolPath
          );

          // Execute
          await sendToken(token0Symbol, token0, this.proxy.address, value);
          await this.proxy.updateTokenMock(token0.address);
          await expectRevert(
            this.proxy.execMock(to, data, { from: user }),
            'HHummus_swapTokensForTokens: ASSET_NOT_EXIST'
          );
        });

        it('should revert: insufficient token', async function () {
          const value = mwei('1000');
          const to = this.hHummus.address;
          const tokenPath = [token0.address, token1.address];
          const poolPath = [pool];

          // Prepare call data
          const data = abi.simpleEncode(
            'swapTokensForTokens(uint256,uint256,address[],address[])',
            value,
            0,
            tokenPath,
            poolPath
          );

          // Execute
          await sendToken(
            token0Symbol,
            token0,
            this.proxy.address,
            value.sub(new BN(1))
          );
          await this.proxy.updateTokenMock(token0.address);
          await expectRevert(
            this.proxy.execMock(to, data, { from: user }),
            'HHummus_swapTokensForTokens: ERC20: transfer amount exceeds balance'
          );
        });
      });
    });

    async function sendToken(symbol, token, to, amount) {
      const baseTokenBalanceSlotNum = await getBalanceSlotNum(
        symbol,
        network.config.chainId
      );
      await setTokenBalance(token.address, to, amount, baseTokenBalanceSlotNum);
    }
  });
});
