const {
  balance,
  BN,
  constants,
  ether,
  expectEvent,
} = require('@openzeppelin/test-helpers');
const { ZERO_BYTES32 } = constants;
const abi = require('ethereumjs-abi');
const utils = web3.utils;

const { expect } = require('chai');

const { evmRevert, evmSnapshot, getFuncSig } = require('./utils/utils');

const Foo = artifacts.require('Foo');
const FooFactory = artifacts.require('FooFactory');
const FooHandler = artifacts.require('FooHandler');
const Foo4 = artifacts.require('Foo4');
const Foo4Handler = artifacts.require('Foo4Handler');
const Registry = artifacts.require('Registry');
const Proxy = artifacts.require('ProxyMock');

contract('ProxyLog', function([_, deployer, user]) {
  let id;

  before(async function() {
    this.registry = await Registry.new();
    this.proxy = await Proxy.new(this.registry.address);
  });

  beforeEach(async function() {
    id = await evmSnapshot();
  });

  afterEach(async function() {
    await evmRevert(id);
  });

  describe.only('execute', function() {
    before(async function() {
      this.fooFactory = await FooFactory.new({ from: deployer });
      expect(this.fooFactory.address).to.be.eq(
        '0xFdd454EA7BF7ca88C1B7a824c3FB0951Fb8a1318'
      );
      await this.fooFactory.createFoo();
      await this.fooFactory.createFoo();
      this.foo0 = await Foo.at(await this.fooFactory.addressOf.call(0));
      this.foo1 = await Foo.at(await this.fooFactory.addressOf.call(1));
      this.foo2 = await Foo.at(await this.fooFactory.addressOf.call(2));
      this.fooHandler = await FooHandler.new();
      await this.registry.register(
        this.fooHandler.address,
        utils.asciiToHex('foo')
      );
    });

    it('multiple', async function() {
      const indices = [0, 1, 2];
      const nums = [new BN('25'), new BN('26'), new BN('27')];
      const tos = [
        this.fooHandler.address,
        this.fooHandler.address,
        this.fooHandler.address,
      ];
      const configs = [ZERO_BYTES32, ZERO_BYTES32, ZERO_BYTES32];
      const datas = [
        abi.simpleEncode('bar(uint256,uint256):(uint256)', indices[0], nums[0]),
        abi.simpleEncode('bar(uint256,uint256):(uint256)', indices[1], nums[1]),
        abi.simpleEncode('bar(uint256,uint256):(uint256)', indices[2], nums[2]),
      ];
      const selector = getFuncSig(FooHandler, 'bar');
      const receipt = await this.proxy.batchExec(tos, configs, datas);
      const result = [
        await this.foo0.accounts.call(this.proxy.address),
        await this.foo1.accounts.call(this.proxy.address),
        await this.foo2.accounts.call(this.proxy.address),
      ];
      expect(result[0]).to.be.bignumber.eq(nums[0]);
      expect(result[1]).to.be.bignumber.eq(nums[1]);
      expect(result[2]).to.be.bignumber.eq(nums[2]);
      expectEvent(receipt, 'LogBegin', {
        handler: this.fooHandler.address,
        selector: utils.padRight(selector, 64),
        payload: '0x' + datas[0].toString('hex'),
      });
      expectEvent(receipt, 'LogEnd', {
        handler: this.fooHandler.address,
        selector: utils.padRight(selector, 64),
        result: utils.padLeft(utils.toHex(result[0]), 64),
      });
      expectEvent(receipt, 'LogBegin', {
        handler: this.fooHandler.address,
        selector: utils.padRight(selector, 64),
        payload: '0x' + datas[1].toString('hex'),
      });
      expectEvent(receipt, 'LogEnd', {
        handler: this.fooHandler.address,
        selector: utils.padRight(selector, 64),
        result: utils.padLeft(utils.toHex(result[1]), 64),
      });
      expectEvent(receipt, 'LogBegin', {
        handler: this.fooHandler.address,
        selector: utils.padRight(selector, 64),
        payload: '0x' + datas[2].toString('hex'),
      });
      expectEvent(receipt, 'LogEnd', {
        handler: this.fooHandler.address,
        selector: utils.padRight(selector, 64),
        result: utils.padLeft(utils.toHex(result[2]), 64),
      });
    });
  });

  describe.only('dynamic parameter', function() {
    before(async function() {
      this.foo = await Foo4.new();
      this.fooHandler = await Foo4Handler.new();
      await this.registry.register(
        this.fooHandler.address,
        utils.asciiToHex('foo4')
      );
    });

    it('static parameter', async function() {
      const tos = [this.fooHandler.address];
      const a =
        '0x00000000000000000000000000000000000000000000000000000000000000ff';
      const configs = [
        '0x0000000000000000000000000000000000000000000000000000000000000000',
      ];
      const datas = [
        abi.simpleEncode('bar1(address,bytes32)', this.foo.address, a),
      ];
      const selector = getFuncSig(Foo4Handler, 'bar1');

      const receipt = await this.proxy.batchExec(tos, configs, datas, {
        from: user,
        value: ether('1'),
      });

      expect(await this.foo.bValue.call()).eq(a);
      expectEvent(receipt, 'LogBegin', {
        handler: this.fooHandler.address,
        selector: utils.padRight(selector, 64),
        payload: '0x' + datas[0].toString('hex'),
      });
      expectEvent(receipt, 'LogEnd', {
        handler: this.fooHandler.address,
        selector: utils.padRight(selector, 64),
        result: a,
      });
    });

    it('replace parameter', async function() {
      const tos = [this.fooHandler.address, this.fooHandler.address];
      const r = await this.foo.bar.call();
      const a =
        '0x0000000000000000000000000000000000000000000000000000000000000000';
      const configs = [
        // 1 32-bytes return value to be referenced
        '0x0001000000000000000000000000000000000000000000000000000000000000',
        '0x0100000000000000000200ffffffffffffffffffffffffffffffffffffffffff',
      ];
      const datas = [
        abi.simpleEncode('bar(address)', this.foo.address),
        abi.simpleEncode('bar1(address,bytes32)', this.foo.address, a),
      ];
      const selectors = [
        getFuncSig(Foo4Handler, 'bar'),
        getFuncSig(Foo4Handler, 'bar1'),
      ];

      const receipt = await this.proxy.batchExec(tos, configs, datas, {
        from: user,
        value: ether('1'),
      });
      // Pad the data by replacing the parameter part with r, which is the execution result of the first handler
      const paddedData = '0x' + datas[1].toString('hex', 0, 36) + r.slice(2);

      expect(await this.foo.bValue.call()).eq(r);
      expectEvent(receipt, 'LogBegin', {
        handler: this.fooHandler.address,
        selector: utils.padRight(selectors[0], 64),
        payload: '0x' + datas[0].toString('hex'),
      });
      expectEvent(receipt, 'LogEnd', {
        handler: this.fooHandler.address,
        selector: utils.padRight(selectors[0], 64),
        result: r,
      });
      expectEvent(receipt, 'LogBegin', {
        handler: this.fooHandler.address,
        selector: utils.padRight(selectors[1], 64),
        payload: paddedData,
      });
      expectEvent(receipt, 'LogEnd', {
        handler: this.fooHandler.address,
        selector: utils.padRight(selectors[1], 64),
        result: r,
      });
    });

    it('replace parameter with dynamic array return', async function() {
      const tos = [this.fooHandler.address, this.fooHandler.address];
      const secAmt = ether('1');
      const ratio = ether('0.7');

      // local stack idx start from [+2] if using dynamic array
      // because it will store 2 extra data(pointer and array length) to local stack in the first and second index
      const configs = [
        // 5 32-bytes return value to be referenced
        '0x0005000000000000000000000000000000000000000000000000000000000000', // be referenced
        '0x0100000000000000000203ffffffffffffffffffffffffffffffffffffffffff', //replace params[1] -> local stack[3]
      ];
      const datas = [
        abi.simpleEncode(
          'barUList(address,uint256,uint256,uint256)',
          this.foo.address,
          ether('1'),
          secAmt,
          ether('1')
        ),
        abi.simpleEncode('barUint1(address,uint256)', this.foo.address, ratio),
      ];
      const selectors = [
        getFuncSig(Foo4Handler, 'barUList'),
        getFuncSig(Foo4Handler, 'barUint1'),
      ];
      const r = web3.eth.abi.encodeParameter('uint256[]', [
        ether('1').toString(),
        secAmt.toString(),
        ether('1').toString(),
      ]);
      const n = secAmt.mul(ratio).div(ether('1'));

      const receipt = await this.proxy.batchExec(tos, configs, datas, {
        from: user,
        value: ether('1'),
      });
      // Pad the data by replacing the parameter part with 0.7 * the execution result of first handler
      const paddedData =
        '0x' +
        datas[1].toString('hex', 0, 36) +
        utils.padLeft(utils.toHex(n), 64).slice(2);

      expect(await this.foo.nValue.call()).to.be.bignumber.eq(n);
      expectEvent(receipt, 'LogBegin', {
        handler: this.fooHandler.address,
        selector: utils.padRight(selectors[0], 64),
        payload: '0x' + datas[0].toString('hex'),
      });
      expectEvent(receipt, 'LogEnd', {
        handler: this.fooHandler.address,
        selector: utils.padRight(selectors[0], 64),
        result: r,
      });
      expectEvent(receipt, 'LogBegin', {
        handler: this.fooHandler.address,
        selector: utils.padRight(selectors[1], 64),
        payload: paddedData,
      });
      expectEvent(receipt, 'LogEnd', {
        handler: this.fooHandler.address,
        selector: utils.padRight(selectors[1], 64),
        result: utils.padLeft(utils.toHex(n), 64),
      });
    });

    it('replace third parameter', async function() {
      const tos = [this.fooHandler.address, this.fooHandler.address];
      const r = await this.foo.bar.call();
      const a =
        '0x000000000000000000000000000000000000000000000000000000000000000a';
      const b =
        '0x0000000000000000000000000000000000000000000000000000000000000000';
      const configs = [
        '0x0001000000000000000000000000000000000000000000000000000000000000',
        '0x0100000000000000000400ffffffffffffffffffffffffffffffffffffffffff',
      ];
      const datas = [
        abi.simpleEncode('bar(address)', this.foo.address),
        abi.simpleEncode(
          'bar2(address,bytes32,bytes32)',
          this.foo.address,
          a,
          b
        ),
      ];
      const selectors = [
        getFuncSig(Foo4Handler, 'bar'),
        getFuncSig(Foo4Handler, 'bar2'),
      ];

      const receipt = await this.proxy.batchExec(tos, configs, datas, {
        from: user,
        value: ether('1'),
      });
      // Pad the data by replacing the third parameter part with the execution result of first handler
      const paddedData = '0x' + datas[1].toString('hex', 0, 68) + r.slice(2);

      expect(await this.foo.bValue.call()).eq(r);
      expectEvent(receipt, 'LogBegin', {
        handler: this.fooHandler.address,
        selector: utils.padRight(selectors[0], 64),
        payload: '0x' + datas[0].toString('hex'),
      });
      expectEvent(receipt, 'LogEnd', {
        handler: this.fooHandler.address,
        selector: utils.padRight(selectors[0], 64),
        result: r,
      });
      expectEvent(receipt, 'LogBegin', {
        handler: this.fooHandler.address,
        selector: utils.padRight(selectors[1], 64),
        payload: paddedData,
      });
      expectEvent(receipt, 'LogEnd', {
        handler: this.fooHandler.address,
        selector: utils.padRight(selectors[1], 64),
        result: r,
      });
    });

    it('replace parameter by 50% of ref value', async function() {
      const tos = [this.fooHandler.address, this.fooHandler.address];
      const r = await this.foo.barUint.call();
      const a = ether('0.5');
      const n = r.mul(a).div(ether('1'));
      const configs = [
        '0x0001000000000000000000000000000000000000000000000000000000000000',
        '0x0100000000000000000200ffffffffffffffffffffffffffffffffffffffffff',
      ];
      const datas = [
        abi.simpleEncode('barUint(address)', this.foo.address),
        abi.simpleEncode('barUint1(address,uint256)', this.foo.address, a),
      ];
      const selectors = [
        getFuncSig(Foo4Handler, 'barUint'),
        getFuncSig(Foo4Handler, 'barUint1'),
      ];

      const receipt = await this.proxy.batchExec(tos, configs, datas, {
        from: user,
        value: ether('1'),
      });
      // Pad the data by replacing the parameter part with 0.5 * the execution result of first handler
      const paddedData =
        '0x' +
        datas[1].toString('hex', 0, 36) +
        utils.padLeft(utils.toHex(n), 64).slice(2);

      expect(await this.foo.nValue.call()).to.be.bignumber.eq(n);
      expectEvent(receipt, 'LogBegin', {
        handler: this.fooHandler.address,
        selector: utils.padRight(selectors[0], 64),
        payload: '0x' + datas[0].toString('hex'),
      });
      expectEvent(receipt, 'LogEnd', {
        handler: this.fooHandler.address,
        selector: utils.padRight(selectors[0], 64),
        result: utils.padLeft(utils.toHex(ether('1')), 64),
      });
      expectEvent(receipt, 'LogBegin', {
        handler: this.fooHandler.address,
        selector: utils.padRight(selectors[1], 64),
        payload: paddedData,
      });
      expectEvent(receipt, 'LogEnd', {
        handler: this.fooHandler.address,
        selector: utils.padRight(selectors[1], 64),
        result: utils.padLeft(utils.toHex(n), 64),
      });
    });
  });
});
