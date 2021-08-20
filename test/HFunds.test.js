const {
  balance,
  BN,
  constants,
  ether,
  expectEvent,
  expectRevert,
  time,
  send,
} = require('@openzeppelin/test-helpers');
const { ZERO_ADDRESS, MAX_UINT256 } = constants;
const { tracker } = balance;
const { latest } = time;
const abi = require('ethereumjs-abi');
const utils = web3.utils;

const { expect } = require('chai');

const {
  DAI_TOKEN,
  DAI_PROVIDER,
  BAT_TOKEN,
  BAT_PROVIDER,
  USDT_TOKEN,
  USDT_PROVIDER,
  ETH_PROVIDER_CONTRACT,
  NATIVE_TOKEN,
} = require('./utils/constants');
const {
  evmRevert,
  evmSnapshot,
  profileGas,
  getHandlerReturn,
} = require('./utils/utils');

const HFunds = artifacts.require('HFunds');
const Registry = artifacts.require('Registry');
const Proxy = artifacts.require('ProxyMock');
const IToken = artifacts.require('IERC20');
const IUsdt = artifacts.require('IERC20Usdt');

contract('Funds', function([_, user, someone]) {
  let id;
  let balanceUser;
  let balanceProxy;
  const tokenAddresses = [DAI_TOKEN, BAT_TOKEN];
  const providerAddresses = [DAI_PROVIDER, BAT_PROVIDER];

  before(async function() {
    this.registry = await Registry.new();
    this.proxy = await Proxy.new(this.registry.address);
    this.hFunds = await HFunds.new();
    await this.registry.register(
      this.hFunds.address,
      utils.asciiToHex('Funds')
    );
  });

  beforeEach(async function() {
    id = await evmSnapshot();
  });

  afterEach(async function() {
    await evmRevert(id);
  });

  describe('update tokens', function() {
    before(async function() {
      this.token0 = await IToken.at(tokenAddresses[0]);
      this.token1 = await IToken.at(tokenAddresses[1]);
      balanceUser = await tracker(user);
      balanceProxy = await tracker(this.proxy.address);
    });

    it('normal', async function() {
      const token = [this.token0.address, this.token1.address];
      const value = [ether('100'), ether('200')];
      const to = this.hFunds.address;
      const data = abi.simpleEncode('updateTokens(address[])', token);
      await this.token0.transfer(this.proxy.address, value[0], {
        from: providerAddresses[0],
      });
      await this.token1.transfer(this.proxy.address, value[1], {
        from: providerAddresses[1],
      });

      const receipt = await this.proxy.execMock(to, data, {
        from: user,
        value: ether('1'),
      });

      const handlerReturn = getHandlerReturn(receipt, ['uint256[]'])[0];
      // Verify token0
      expect(handlerReturn[0]).to.be.bignumber.eq(value[0]);
      expect(await this.token0.balanceOf.call(this.proxy.address)).to.be.zero;
      expect(await this.token0.balanceOf.call(user)).to.be.bignumber.eq(
        value[0]
      );

      // Verify token1
      expect(handlerReturn[1]).to.be.bignumber.eq(value[1]);
      expect(await this.token1.balanceOf.call(this.proxy.address)).to.be.zero;
      expect(await this.token1.balanceOf.call(user)).to.be.bignumber.eq(
        value[1]
      );

      profileGas(receipt);
    });

    it('native token - zero address', async function() {
      const token = [this.token0.address, ZERO_ADDRESS];
      const msgValue = ether('0.1');
      const value = [ether('200'), ether('1')];
      const to = this.hFunds.address;
      const data = abi.simpleEncode('updateTokens(address[])', token);
      // Transfer tokens to proxy first
      await this.token0.transfer(this.proxy.address, value[0], {
        from: providerAddresses[0],
      });
      // Proxy does not allow transfer ether from EOA so we use provider contract
      await send.ether(ETH_PROVIDER_CONTRACT, this.proxy.address, value[1]);
      await balanceUser.get();

      const receipt = await this.proxy.execMock(to, data, {
        from: user,
        value: msgValue,
      });

      const handlerReturn = getHandlerReturn(receipt, ['uint256[]'])[0];
      // Verify token0
      expect(handlerReturn[0]).to.be.bignumber.eq(value[0]);
      expect(await this.token0.balanceOf.call(this.proxy.address)).to.be.zero;
      expect(await this.token0.balanceOf.call(user)).to.be.bignumber.eq(
        value[0]
      );

      // Verify ether
      expect(handlerReturn[1]).to.be.bignumber.eq(value[1].add(msgValue)); // handlerReturn should include msg.value
      expect(await balanceProxy.get()).to.be.zero;
      // user balance will not include msg.value because it is provided by user itself
      expect(await balanceUser.delta()).to.be.bignumber.eq(
        value[1].sub(new BN(receipt.receipt.gasUsed))
      );

      profileGas(receipt);
    });

    it('native token - 0xEEEE', async function() {
      const token = [this.token0.address, NATIVE_TOKEN];
      const msgValue = ether('0.1');
      const value = [ether('200'), ether('1')];
      const to = this.hFunds.address;
      const data = abi.simpleEncode('updateTokens(address[])', token);
      // Transfer tokens to proxy first
      await this.token0.transfer(this.proxy.address, value[0], {
        from: providerAddresses[0],
      });
      // Proxy does not allow transfer ether from EOA so we use provider contract
      await send.ether(ETH_PROVIDER_CONTRACT, this.proxy.address, value[1]);
      await balanceUser.get();

      const receipt = await this.proxy.execMock(to, data, {
        from: user,
        value: msgValue,
      });

      const handlerReturn = getHandlerReturn(receipt, ['uint256[]'])[0];
      // Verify token0
      expect(handlerReturn[0]).to.be.bignumber.eq(value[0]);
      expect(await this.token0.balanceOf.call(this.proxy.address)).to.be.zero;
      expect(await this.token0.balanceOf.call(user)).to.be.bignumber.eq(
        value[0]
      );

      // Verify ether
      expect(handlerReturn[1]).to.be.bignumber.eq(value[1].add(msgValue)); // handlerReturn should include msg.value
      expect(await balanceProxy.get()).to.be.zero;
      // user balance will not include msg.value because it is provided by user itself
      expect(await balanceUser.delta()).to.be.bignumber.eq(
        value[1].sub(new BN(receipt.receipt.gasUsed))
      );

      profileGas(receipt);
    });
  });

  describe('inject', function() {
    describe('single token', function() {
      before(async function() {
        this.token0 = await IToken.at(tokenAddresses[0]);
        this.usdt = await IUsdt.at(USDT_TOKEN);
      });

      it('normal', async function() {
        const token = [this.token0.address];
        const value = [ether('100')];
        const to = this.hFunds.address;
        const data = abi.simpleEncode(
          'inject(address[],uint256[])',
          token,
          value
        );
        await this.token0.transfer(user, value[0], {
          from: providerAddresses[0],
        });
        await this.token0.approve(this.proxy.address, value[0], { from: user });

        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: ether('0.1'),
        });

        const handlerReturn = getHandlerReturn(receipt, ['uint256[]'])[0];
        expect(handlerReturn[0]).to.be.bignumber.eq(value[0]);
        await expectEvent.inTransaction(receipt.tx, this.token0, 'Transfer', {
          from: user,
          to: this.proxy.address,
          value: value[0],
        });
        await expectEvent.inTransaction(receipt.tx, this.token0, 'Transfer', {
          from: this.proxy.address,
          to: user,
          value: value[0],
        });
        profileGas(receipt);
      });

      it('USDT', async function() {
        const token = [this.usdt.address];
        const value = [new BN('1000000')];
        const to = this.hFunds.address;
        const data = abi.simpleEncode(
          'inject(address[],uint256[])',
          token,
          value
        );
        await this.usdt.transfer(user, value[0], {
          from: USDT_PROVIDER,
        });
        await this.usdt.approve(this.proxy.address, value[0], { from: user });

        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: ether('0.1'),
        });

        const handlerReturn = getHandlerReturn(receipt, ['uint256[]'])[0];
        expect(handlerReturn[0]).to.be.bignumber.eq(value[0]);
        await expectEvent.inTransaction(receipt.tx, this.usdt, 'Transfer', {
          from: user,
          to: this.proxy.address,
          value: value[0],
        });
        await expectEvent.inTransaction(receipt.tx, this.usdt, 'Transfer', {
          from: this.proxy.address,
          to: user,
          value: value[0],
        });
        profileGas(receipt);
      });
    });

    describe('multiple tokens', function() {
      before(async function() {
        this.token0 = await IToken.at(tokenAddresses[0]);
        this.token1 = await IToken.at(tokenAddresses[1]);
      });

      it('normal', async function() {
        const token = [this.token0.address, this.token1.address];
        const value = [ether('100'), ether('200')];
        const to = this.hFunds.address;
        const data = abi.simpleEncode(
          'inject(address[],uint256[])',
          token,
          value
        );
        await this.token0.transfer(user, value[0], {
          from: providerAddresses[0],
        });
        await this.token0.approve(this.proxy.address, value[0], { from: user });
        await this.token1.transfer(user, value[1], {
          from: providerAddresses[1],
        });
        await this.token1.approve(this.proxy.address, value[1], { from: user });

        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: ether('1'),
        });

        const handlerReturn = getHandlerReturn(receipt, ['uint256[]'])[0];
        expect(handlerReturn[0]).to.be.bignumber.eq(value[0]);
        await expectEvent.inTransaction(receipt.tx, this.token0, 'Transfer', {
          from: user,
          to: this.proxy.address,
          value: value[0],
        });
        await expectEvent.inTransaction(receipt.tx, this.token0, 'Transfer', {
          from: this.proxy.address,
          to: user,
          value: value[0],
        });

        expect(handlerReturn[1]).to.be.bignumber.eq(value[1]);
        await expectEvent.inTransaction(receipt.tx, this.token1, 'Transfer', {
          from: user,
          to: this.proxy.address,
          value: value[1],
        });
        await expectEvent.inTransaction(receipt.tx, this.token1, 'Transfer', {
          from: this.proxy.address,
          to: user,
          value: value[1],
        });
        profileGas(receipt);
      });
    });
  });

  describe('send', function() {
    before(async function() {
      this.token = await IToken.at(tokenAddresses[0]);
      this.usdt = await IUsdt.at(USDT_TOKEN);
    });

    describe('token', function() {
      it('normal', async function() {
        const token = this.token.address;
        const providerAddress = providerAddresses[0];
        const value = ether('100');
        const receiver = someone;
        const to = this.hFunds.address;
        const data = abi.simpleEncode(
          'sendToken(address,uint256,address)',
          token,
          value,
          receiver
        );
        await this.token.transfer(this.proxy.address, value, {
          from: providerAddress,
        });
        await this.proxy.updateTokenMock(this.token.address);
        const tokenSomeone = await this.token.balanceOf.call(someone);
        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: ether('0.1'),
        });

        await expectEvent.inTransaction(receipt.tx, this.token, 'Transfer', {
          from: this.proxy.address,
          to: someone,
          value: value,
        });
        const tokenSomeoneEnd = await this.token.balanceOf.call(someone);
        expect(tokenSomeoneEnd.sub(tokenSomeone)).to.be.bignumber.eq(value);
        profileGas(receipt);
      });

      it('USDT', async function() {
        const token = this.usdt.address;
        const providerAddress = USDT_PROVIDER;
        const value = new BN('1000000');
        const receiver = someone;
        const to = this.hFunds.address;
        const data = abi.simpleEncode(
          'sendToken(address,uint256,address)',
          token,
          value,
          receiver
        );
        await this.usdt.transfer(this.proxy.address, value, {
          from: providerAddress,
        });
        await this.proxy.updateTokenMock(this.token.address);

        const tokenSomeone = await this.usdt.balanceOf.call(someone);
        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: ether('0.1'),
        });

        await expectEvent.inTransaction(receipt.tx, this.usdt, 'Transfer', {
          from: this.proxy.address,
          to: someone,
          value: value,
        });
        const tokenSomeoneEnd = await this.usdt.balanceOf.call(someone);
        expect(tokenSomeoneEnd.sub(tokenSomeone)).to.be.bignumber.eq(value);
        profileGas(receipt);
      });

      it('maximum', async function() {
        const token = this.token.address;
        const providerAddress = providerAddresses[0];
        const value = ether('10');
        const receiver = someone;
        const to = this.hFunds.address;
        const data = abi.simpleEncode(
          'sendToken(address,uint256,address)',
          token,
          MAX_UINT256,
          receiver
        );
        await this.token.transfer(this.proxy.address, value, {
          from: providerAddress,
        });
        await this.proxy.updateTokenMock(this.token.address);
        const tokenSomeone = await this.token.balanceOf.call(someone);
        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: ether('0.1'),
        });

        await expectEvent.inTransaction(receipt.tx, this.token, 'Transfer', {
          from: this.proxy.address,
          to: someone,
          value: value,
        });
        const tokenSomeoneEnd = await this.token.balanceOf.call(someone);
        expect(tokenSomeoneEnd.sub(tokenSomeone)).to.be.bignumber.eq(value);
        profileGas(receipt);
      });

      it('send 0 token', async function() {
        const token = this.token.address;
        const providerAddress = providerAddresses[0];
        const value = ether('0');
        const receiver = someone;
        const to = this.hFunds.address;
        const data = abi.simpleEncode(
          'sendToken(address,uint256,address)',
          token,
          value,
          receiver
        );
        await this.token.transfer(this.proxy.address, value, {
          from: providerAddress,
        });
        await this.proxy.updateTokenMock(this.token.address);
        const tokenSomeone = await this.token.balanceOf.call(someone);
        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: ether('0.1'),
        });

        await expectEvent.notEmitted.inTransaction(
          receipt.tx,
          this.token,
          'Transfer',
          {
            from: this.proxy.address,
            to: someone,
            value: value,
          }
        );
        const tokenSomeoneEnd = await this.token.balanceOf.call(someone);
        expect(tokenSomeoneEnd.sub(tokenSomeone)).to.be.bignumber.eq(value);
        profileGas(receipt);
      });

      it('insufficient token', async function() {
        const token = this.token.address;
        const providerAddress = providerAddresses[0];
        const value = ether('100');
        const receiver = someone;
        const to = this.hFunds.address;
        const data = abi.simpleEncode(
          'sendToken(address,uint256,address)',
          token,
          value,
          receiver
        );
        await this.token.transfer(this.proxy.address, value.sub(ether('1')), {
          from: providerAddress,
        });
        await this.proxy.updateTokenMock(this.token.address);
        const tokenSomeone = await this.token.balanceOf.call(someone);
        await expectRevert.unspecified(
          this.proxy.execMock(to, data, {
            from: user,
            value: ether('0.1'),
          })
        );
      });
    });

    describe('Ether', async function() {
      it('normal', async function() {
        const value = ether('1');
        const receiver = someone;
        const to = this.hFunds.address;
        const data = abi.simpleEncode('send(uint256,address)', value, receiver);
        let balanceSomeone = await tracker(someone);
        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: value,
        });
        expect(await balanceSomeone.delta()).to.be.bignumber.eq(value);
        profileGas(receipt);
      });

      it('maximum', async function() {
        const value = ether('1');
        const receiver = someone;
        const to = this.hFunds.address;
        const data = abi.simpleEncode(
          'send(uint256,address)',
          MAX_UINT256,
          receiver
        );
        let balanceSomeone = await tracker(someone);
        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: value,
        });
        expect(await balanceSomeone.delta()).to.be.bignumber.eq(value);
        profileGas(receipt);
      });

      it('send 0 eth', async function() {
        const value = ether('0');
        const receiver = someone;
        const to = this.hFunds.address;
        const data = abi.simpleEncode('send(uint256,address)', value, receiver);
        let balanceSomeone = await tracker(someone);
        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: value,
        });
        expect(await balanceSomeone.delta()).to.be.bignumber.eq(value);
        profileGas(receipt);
      });

      it('insufficient ether', async function() {
        const value = ether('1');
        const receiver = someone;
        const to = this.hFunds.address;
        const data = abi.simpleEncode('send(uint256,address)', value, receiver);
        let balanceSomeone = await tracker(someone);
        await expectRevert.unspecified(
          this.proxy.execMock(to, data, {
            from: user,
            value: value.sub(ether('0.1')),
          })
        );
      });
    });

    describe('multiple tokens', function() {
      before(async function() {
        this.token0 = this.usdt;
        this.token1 = await IToken.at(tokenAddresses[1]);
      });

      it('multiple tokens', async function() {
        const tokens = [this.token0.address, this.token1.address];
        const value = [new BN(10000000), ether('15')];
        const receiver = someone;
        const to = this.hFunds.address;
        const data = abi.simpleEncode(
          'sendTokens(address[],uint256[],address)',
          tokens,
          value,
          receiver
        );

        await this.token0.transfer(this.proxy.address, value[0], {
          from: USDT_PROVIDER,
        });
        await this.token1.transfer(this.proxy.address, value[1], {
          from: providerAddresses[1],
        });

        await this.proxy.updateTokenMock(this.token0.address);
        await this.proxy.updateTokenMock(this.token1.address);

        const token0Someone = await this.token0.balanceOf.call(someone);
        const token1Someone = await this.token1.balanceOf.call(someone);
        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: ether('0.1'),
        });

        await expectEvent.inTransaction(receipt.tx, this.token0, 'Transfer', {
          from: this.proxy.address,
          to: someone,
          value: value[0],
        });

        await expectEvent.inTransaction(receipt.tx, this.token1, 'Transfer', {
          from: this.proxy.address,
          to: someone,
          value: value[1],
        });

        const token0SomeoneEnd = await this.token0.balanceOf.call(someone);
        expect(token0SomeoneEnd.sub(token0Someone)).to.be.bignumber.eq(
          value[0]
        );

        const token1SomeoneEnd = await this.token1.balanceOf.call(someone);
        expect(token1SomeoneEnd.sub(token1Someone)).to.be.bignumber.eq(
          value[1]
        );
        profileGas(receipt);
      });

      it('token and eth', async function() {
        const tokens = [ZERO_ADDRESS, this.token1.address];
        const value = [ether('10'), ether('15')];
        const receiver = someone;
        const to = this.hFunds.address;
        const data = abi.simpleEncode(
          'sendTokens(address[],uint256[],address)',
          tokens,
          value,
          receiver
        );

        await this.token1.transfer(this.proxy.address, value[1], {
          from: providerAddresses[1],
        });

        await this.proxy.updateTokenMock(this.token1.address);

        const token1Someone = await this.token1.balanceOf.call(someone);
        let balanceSomeone = await tracker(someone);
        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: value[0],
        });

        await expectEvent.inTransaction(receipt.tx, this.token1, 'Transfer', {
          from: this.proxy.address,
          to: someone,
          value: value[1],
        });

        expect(await balanceSomeone.delta()).to.be.bignumber.eq(value[0]);

        const token1SomeoneEnd = await this.token1.balanceOf.call(someone);
        expect(token1SomeoneEnd.sub(token1Someone)).to.be.bignumber.eq(
          value[1]
        );
        profileGas(receipt);
      });

      it('max amount', async function() {
        const tokens = [ZERO_ADDRESS, this.token1.address];
        const value = [ether('10'), ether('15')];
        const receiver = someone;
        const to = this.hFunds.address;
        const data = abi.simpleEncode(
          'sendTokens(address[],uint256[],address)',
          tokens,
          [MAX_UINT256, MAX_UINT256],
          receiver
        );

        await this.token1.transfer(this.proxy.address, value[1], {
          from: providerAddresses[1],
        });

        await this.proxy.updateTokenMock(this.token1.address);

        const token1Someone = await this.token1.balanceOf.call(someone);
        let balanceSomeone = await tracker(someone);
        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: value[0],
        });

        await expectEvent.inTransaction(receipt.tx, this.token1, 'Transfer', {
          from: this.proxy.address,
          to: someone,
          value: value[1],
        });

        expect(await balanceSomeone.delta()).to.be.bignumber.eq(value[0]);

        const token1SomeoneEnd = await this.token1.balanceOf.call(someone);
        expect(token1SomeoneEnd.sub(token1Someone)).to.be.bignumber.eq(
          value[1]
        );
        profileGas(receipt);
      });

      it('zero case', async function() {
        const tokens = [ZERO_ADDRESS, this.token1.address];
        const value = [ether('0'), ether('0')];
        const receiver = someone;
        const to = this.hFunds.address;
        const data = abi.simpleEncode(
          'sendTokens(address[],uint256[],address)',
          tokens,
          value,
          receiver
        );

        await this.token1.transfer(this.proxy.address, value[1], {
          from: providerAddresses[1],
        });

        await this.proxy.updateTokenMock(this.token1.address);

        const token1Someone = await this.token1.balanceOf.call(someone);
        let balanceSomeone = await tracker(someone);
        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: value[0],
        });

        await expectEvent.notEmitted.inTransaction(
          receipt.tx,
          this.token1,
          'Transfer',
          {
            from: this.proxy.address,
            to: someone,
            value: value[1],
          }
        );

        expect(await balanceSomeone.delta()).to.be.bignumber.eq(value[0]);
        const token1SomeoneEnd = await this.token1.balanceOf.call(someone);
        expect(token1SomeoneEnd.sub(token1Someone)).to.be.bignumber.eq(
          value[1]
        );
        profileGas(receipt);
      });

      it('insufficient token', async function() {
        const tokens = [ZERO_ADDRESS, this.token1.address];
        const value = [ether('10'), ether('15')];
        const receiver = someone;
        const to = this.hFunds.address;
        const data = abi.simpleEncode(
          'sendTokens(address[],uint256[],address)',
          tokens,
          value,
          receiver
        );

        await this.token1.transfer(this.proxy.address, value[1], {
          from: providerAddresses[1],
        });

        await this.proxy.updateTokenMock(this.token1.address);

        const token1Someone = await this.token1.balanceOf.call(someone);
        let balanceSomeone = await tracker(someone);

        await expectRevert.unspecified(
          this.proxy.execMock(to, data, {
            from: user,
            value: ether('0.1'),
          })
        );
      });
    });
  });

  describe('get balance', function() {
    before(async function() {
      this.token = await IToken.at(tokenAddresses[0]);
      this.usdt = await IUsdt.at(USDT_TOKEN);
    });
    describe('Ether', async function() {
      it('normal', async function() {
        const token = constants.ZERO_ADDRESS;
        const value = ether('1');
        const providerAddress = providerAddresses[0];
        const to = this.hFunds.address;
        const data = abi.simpleEncode(
          'getBalance(address):(uint256)',
          constants.ZERO_ADDRESS
        );

        await this.proxy.updateTokenMock(this.token.address);
        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: value,
        });

        const handlerReturn = utils.toBN(
          getHandlerReturn(receipt, ['uint256'])[0]
        );

        expect(handlerReturn).to.be.bignumber.eq(value);
        profileGas(receipt);
      });

      describe('token', function() {
        it('normal', async function() {
          const token = this.token.address;
          const value = ether('1');
          const providerAddress = providerAddresses[0];
          const to = this.hFunds.address;
          const data = abi.simpleEncode('getBalance(address):(uint256)', token);
          await this.token.transfer(this.proxy.address, value, {
            from: providerAddress,
          });
          await this.proxy.updateTokenMock(this.token.address);
          const receipt = await this.proxy.execMock(to, data, {
            from: user,
            value: ether('0.1'),
          });

          const handlerReturn = utils.toBN(
            getHandlerReturn(receipt, ['uint256'])[0]
          );

          expect(handlerReturn).to.be.bignumber.eq(value);
          profileGas(receipt);
        });
      });
    });
  });

  describe('check slippage', function() {
    before(async function() {
      this.token0 = await IToken.at(tokenAddresses[0]);
      this.token1 = await IToken.at(tokenAddresses[1]);
    });

    it('normal', async function() {
      const token = [this.token0.address, this.token1.address, ZERO_ADDRESS];
      const value = [ether('10'), ether('10'), ether('10')];
      const to = this.hFunds.address;
      const data = abi.simpleEncode(
        'checkSlippage(address[],uint256[])',
        token,
        value
      );

      await this.token0.transfer(this.proxy.address, value[0], {
        from: providerAddresses[0],
      });

      await this.token1.transfer(this.proxy.address, value[1], {
        from: providerAddresses[1],
      });

      const receipt = await this.proxy.execMock(to, data, {
        from: user,
        value: value[2],
      });

      profileGas(receipt);
    });

    it('should revert: eth slippage', async function() {
      const token = [this.token0.address, this.token1.address, ZERO_ADDRESS];
      const value = [ether('10'), ether('10'), ether('10')];
      const to = this.hFunds.address;
      const data = abi.simpleEncode(
        'checkSlippage(address[],uint256[])',
        token,
        value
      );

      await this.token0.transfer(this.proxy.address, value[0], {
        from: providerAddresses[0],
      });

      await this.token1.transfer(this.proxy.address, value[1], {
        from: providerAddresses[1],
      });
      revertValue = ether('1');

      await expectRevert(
        this.proxy.execMock(to, data, {
          from: user,
          value: revertValue,
        }),
        'HFunds_checkSlippage: error: 2_' + revertValue.toString()
      );
    });

    it('should revert: token slippage', async function() {
      const token = [this.token0.address, this.token1.address, ZERO_ADDRESS];
      const value = [ether('10'), ether('10'), ether('10')];
      const to = this.hFunds.address;
      const data = abi.simpleEncode(
        'checkSlippage(address[],uint256[])',
        token,
        value
      );

      revertValue = ether('1');
      await this.token0.transfer(this.proxy.address, revertValue, {
        from: providerAddresses[0],
      });

      await this.token1.transfer(this.proxy.address, value[1], {
        from: providerAddresses[1],
      });

      await expectRevert(
        this.proxy.execMock(to, data, {
          from: user,
          value: value[2],
        }),
        'HFunds_checkSlippage: error: 0_' + revertValue.toString()
      );
    });
  });
});
