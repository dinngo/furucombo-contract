const { balance, BN, ether, constants } = require('@openzeppelin/test-helpers');
const { web3 } = require('@openzeppelin/test-helpers/src/setup');
const { tracker } = balance;
const { expect } = require('chai');
const abi = require('ethereumjs-abi');
const utils = web3.utils;
const {
  ETH_TOKEN,
  USDT_TOKEN,
  USDT_PROVIDER,
  WBTC_TOKEN,
  WBTC_PROVIDER,
  CURVE_TRICRYPTO_SWAP,
  CURVE_TRICRYPTO_DEPOSIT,
  CURVE_TRICRYPTOCRV,
  CURVE_TRICRYPTOCRV_PROVIDER,
} = require('./utils/constants');
const {
  evmRevert,
  evmSnapshot,
  mulPercent,
  profileGas,
  getHandlerReturn,
} = require('./utils/utils');

const Proxy = artifacts.require('ProxyMock');
const Registry = artifacts.require('Registry');
const HCurve = artifacts.require('HCurve');
const ICurveHandler = artifacts.require('ICurveHandler');
const IToken = artifacts.require('IERC20');

contract('Curve Crypto', function([_, user]) {
  const slippage = new BN('3');
  let id;
  before(async function() {
    this.registry = await Registry.new();
    this.hCurve = await HCurve.new();
    await this.registry.register(
      this.hCurve.address,
      utils.asciiToHex('HCurve')
    );
    this.proxy = await Proxy.new(this.registry.address);
    this.tricryptoSwap = await ICurveHandler.at(CURVE_TRICRYPTO_SWAP);
    this.tricryptoDeposit = await ICurveHandler.at(CURVE_TRICRYPTO_DEPOSIT);
  });

  beforeEach(async function() {
    id = await evmSnapshot();
  });

  afterEach(async function() {
    await evmRevert(id);
  });

  describe('Exchange', function() {
    describe('tricrypto pool', function() {
      const token0Address = USDT_TOKEN;
      const token1Address = WBTC_TOKEN;
      const provider0Address = USDT_PROVIDER;

      let token0, token1;
      let balanceUser, balanceProxy;
      let token0User, token1User;
      let answer, receipt;

      before(async function() {
        token0 = await IToken.at(token0Address);
        token1 = await IToken.at(token1Address);
      });

      beforeEach(async function() {
        balanceUser = await tracker(user);
        balanceProxy = await tracker(this.proxy.address);
        token0User = await token0.balanceOf.call(user);
        token1User = await token1.balanceOf.call(user);
      });

      afterEach(async function() {
        // Check handler return
        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );
        expect(handlerReturn).to.be.bignumber.eq(answer);

        // Check proxy
        expect(await balanceProxy.get()).to.be.zero;
        expect(await token0.balanceOf.call(this.proxy.address)).to.be.zero;
        expect(await token1.balanceOf.call(this.proxy.address)).to.be.zero;

        profileGas(receipt);
      });

      it('Exact input swap USDT to WBTC by exchange', async function() {
        const value = new BN('1000000');
        answer = await this.tricryptoSwap.methods[
          'get_dy(uint256,uint256,uint256)'
        ](0, 1, value);

        const data = abi.simpleEncode(
          'exchange(address,address,address,int128,int128,uint256,uint256,bool,bool)',
          this.tricryptoSwap.address,
          token0.address,
          token1.address,
          0,
          1,
          value,
          mulPercent(answer, new BN('100').sub(slippage)),
          true, // isUint256
          true // useEth, token to token don't care this flag
        );
        await token0.transfer(this.proxy.address, value, {
          from: provider0Address,
        });
        await this.proxy.updateTokenMock(token0.address);
        receipt = await this.proxy.execMock(this.hCurve.address, data, {
          from: user,
          value: ether('1'), // Ensure handler can correctly deal with ether
        });

        // Check user
        expect(await balanceUser.delta()).to.be.bignumber.eq(
          ether('0').sub(new BN(receipt.receipt.gasUsed))
        );
        expect(await token1.balanceOf.call(user)).to.be.bignumber.eq(
          answer.sub(token1User)
        );
      });

      it('Exact input swap USDT to ETH by exchange', async function() {
        const value = new BN('1000000');
        answer = await this.tricryptoSwap.methods[
          'get_dy(uint256,uint256,uint256)'
        ](0, 2, value);

        const data = abi.simpleEncode(
          'exchange(address,address,address,int128,int128,uint256,uint256,bool,bool)',
          this.tricryptoSwap.address,
          token0.address,
          ETH_TOKEN,
          0,
          2,
          value,
          mulPercent(answer, new BN('100').sub(slippage)),
          true, // isUint256
          true // useEth
        );
        await token0.transfer(this.proxy.address, value, {
          from: provider0Address,
        });
        await this.proxy.updateTokenMock(token0.address);
        receipt = await this.proxy.execMock(this.hCurve.address, data, {
          from: user,
          value: 0,
        });

        // Check user
        expect(await balanceUser.delta()).to.be.bignumber.eq(
          ether('0')
            .add(answer)
            .sub(new BN(receipt.receipt.gasUsed))
        );
      });

      it('Exact input swap ETH to WBTC by exchange', async function() {
        const value = ether('1');
        answer = await this.tricryptoSwap.methods[
          'get_dy(uint256,uint256,uint256)'
        ](2, 1, value);

        const data = abi.simpleEncode(
          'exchange(address,address,address,int128,int128,uint256,uint256,bool,bool)',
          this.tricryptoSwap.address,
          ETH_TOKEN,
          token1.address,
          2,
          1,
          value,
          mulPercent(answer, new BN('100').sub(slippage)),
          true, // isUint256
          true // useEth
        );
        receipt = await this.proxy.execMock(this.hCurve.address, data, {
          from: user,
          value: value,
        });

        // Check user
        expect(await balanceUser.delta()).to.be.bignumber.eq(
          ether('0')
            .sub(value)
            .sub(new BN(receipt.receipt.gasUsed))
        );
        expect(await token1.balanceOf.call(user)).to.be.bignumber.eq(
          answer.sub(token1User)
        );
      });
    });
  });

  describe('Liquidity with deposit contract', function() {
    describe('tricrypto pool', function() {
      const token0Address = USDT_TOKEN;
      const token1Address = WBTC_TOKEN;
      const provider0Address = USDT_PROVIDER;
      const provider1Address = WBTC_PROVIDER;
      const poolTokenAddress = CURVE_TRICRYPTOCRV;
      const poolTokenProvider = CURVE_TRICRYPTOCRV_PROVIDER;

      let token0, token1, poolToken;
      let balanceUser, balanceProxy;
      let token0User, token1User, poolTokenUser;

      before(async function() {
        token0 = await IToken.at(token0Address);
        token1 = await IToken.at(token1Address);
        poolToken = await IToken.at(poolTokenAddress);
      });

      beforeEach(async function() {
        balanceUser = await tracker(user);
        balanceProxy = await tracker(this.proxy.address);
        token0User = await token0.balanceOf.call(user);
        token1User = await token1.balanceOf.call(user);
        poolTokenUser = await poolToken.balanceOf.call(user);
      });

      afterEach(async function() {
        // Check proxy
        expect(await balanceProxy.get()).to.be.zero;
        expect(await token0.balanceOf.call(this.proxy.address)).to.be.zero;
        expect(await token1.balanceOf.call(this.proxy.address)).to.be.zero;
        expect(await poolToken.balanceOf.call(this.proxy.address)).to.be.zero;
      });

      it('add USDT, WBTC and ETH to pool by addLiquidity', async function() {
        const token0Amount = new BN('1000000000'); // 1e9
        const token1Amount = new BN('10000000'); // 1e7
        const value = ether('1');
        const tokens = [token0.address, token1.address, ETH_TOKEN];
        const amounts = [token0Amount, token1Amount, value];

        // Get expected answer
        const answer = await this.tricryptoSwap.methods[
          'calc_token_amount(uint256[3],bool)'
        ](amounts, true);

        // Execute handler
        await token0.transfer(this.proxy.address, token0Amount, {
          from: provider0Address,
        });
        await token1.transfer(this.proxy.address, token1Amount, {
          from: provider1Address,
        });
        await this.proxy.updateTokenMock(token0.address);
        await this.proxy.updateTokenMock(token1.address);
        const minMintAmount = mulPercent(answer, new BN('100').sub(slippage));
        const data = abi.simpleEncode(
          'addLiquidity(address,address,address[],uint256[],uint256)',
          this.tricryptoDeposit.address,
          poolToken.address,
          tokens,
          amounts,
          minMintAmount
        );
        const receipt = await this.proxy.execMock(this.hCurve.address, data, {
          from: user,
          value: value,
        });

        // Check handler return
        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );
        const poolTokenUserEnd = await poolToken.balanceOf.call(user);
        expect(handlerReturn).to.be.bignumber.eq(
          poolTokenUserEnd.sub(poolTokenUser)
        );

        // Check user
        expect(await balanceUser.delta()).to.be.bignumber.eq(
          ether('0')
            .sub(value)
            .sub(new BN(receipt.receipt.gasUsed))
        );
        expect(await token0.balanceOf.call(user)).to.be.bignumber.eq(
          token0User
        );
        expect(await token1.balanceOf.call(user)).to.be.bignumber.eq(
          token1User
        );
        // poolToken amount should be greater than answer * 0.999 which is
        // referenced from tests in curve contract.
        expect(poolTokenUserEnd).to.be.bignumber.gte(
          answer.mul(new BN('999')).div(new BN('1000'))
        );
        expect(poolTokenUserEnd).to.be.bignumber.lte(answer);

        profileGas(receipt);
      });

      it('remove from pool to USDT by removeLiquidityOneCoin', async function() {
        const amount = ether('0.1');
        const answer = await this.tricryptoSwap.methods[
          'calc_withdraw_one_coin(uint256,uint256)'
        ](amount, 0);
        await poolToken.transfer(this.proxy.address, amount, {
          from: poolTokenProvider,
        });
        await this.proxy.updateTokenMock(poolToken.address);
        const minAmount = mulPercent(answer, new BN('100').sub(slippage));
        const data = abi.simpleEncode(
          'removeLiquidityOneCoin(address,address,address,uint256,int128,uint256,bool)',
          this.tricryptoDeposit.address,
          poolToken.address,
          token0.address,
          amount,
          0,
          minAmount,
          true // isUint256
        );
        const receipt = await this.proxy.execMock(this.hCurve.address, data, {
          from: user,
          value: ether('1'),
        });

        // Check handler return
        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );
        expect(handlerReturn).to.be.bignumber.eq(answer);

        // Check user
        expect(await token0.balanceOf.call(user)).to.be.bignumber.eq(
          token0User.add(answer)
        );

        profileGas(receipt);
      });

      it('remove from pool to ETH by removeLiquidityOneCoin', async function() {
        const amount = ether('0.1');
        const answer = await this.tricryptoSwap.methods[
          'calc_withdraw_one_coin(uint256,uint256)'
        ](amount, 2);
        await poolToken.transfer(this.proxy.address, amount, {
          from: poolTokenProvider,
        });
        await this.proxy.updateTokenMock(poolToken.address);
        const minAmount = mulPercent(answer, new BN('100').sub(slippage));
        const data = abi.simpleEncode(
          'removeLiquidityOneCoin(address,address,address,uint256,int128,uint256,bool)',
          this.tricryptoDeposit.address,
          poolToken.address,
          ETH_TOKEN,
          amount,
          2,
          minAmount,
          true // isUint256
        );
        const receipt = await this.proxy.execMock(this.hCurve.address, data, {
          from: user,
          value: 0,
        });

        // Check handler return
        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );
        expect(handlerReturn).to.be.bignumber.eq(answer);

        // Check user
        expect(await balanceUser.delta()).to.be.bignumber.eq(
          ether('0')
            .add(answer)
            .sub(new BN(receipt.receipt.gasUsed))
        );

        profileGas(receipt);
      });
    });
  });
});
