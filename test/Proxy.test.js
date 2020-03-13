const { BN, constants, expectEvent, expectRevert } = require('@openzeppelin/test-helpers');
const abi = require('ethereumjs-abi');

const { expect } = require('chai');

const Foo = artifacts.require('Foo');
const FooFactory = artifacts.require('FooFactory');
const FooHandler = artifacts.require('FooHandler');
const Proxy = artifacts.require('ProxyMock');

contract('Proxy', function ([_, deployer]) {
    before(async function () {
        this.fooFactory = await FooFactory.new({ from: deployer });
        expect(this.fooFactory.address).to.be.eq('0xb9A219631Aed55eBC3D998f17C3840B7eC39C0cc');
        await this.fooFactory.createFoo();
        await this.fooFactory.createFoo();
        this.foo0 = await Foo.at(await this.fooFactory.addressOf.call(0));
        this.foo1 = await Foo.at(await this.fooFactory.addressOf.call(1));
        this.foo2 = await Foo.at(await this.fooFactory.addressOf.call(2));
        this.proxy = await Proxy.new();
        this.fooHandler = await FooHandler.new();
    });

    describe('execute', function () {
        it('single', async function () {
            const index = 0;
            const num = new BN('25');
            const data1 = abi.simpleEncode(
                'bar(uint256,uint256):(uint256)',
                index,
                num
            );
            await this.proxy.execMock(this.fooHandler.address, data1);
            const result = await this.foo0.accounts.call(this.proxy.address);
            expect(result).to.be.bignumber.eq(num);
        });

        it('multiple', async function () {
            const index = [0, 1, 2];
            const num = [new BN('25'), new BN('26'), new BN('27')];
            const to = [
                this.fooHandler.address,
                this.fooHandler.address,
                this.fooHandler.address
            ]
            const data = [
                abi.simpleEncode('bar(uint256,uint256):(uint256)', index[0], num[0]),
                abi.simpleEncode('bar(uint256,uint256):(uint256)', index[1], num[1]),
                abi.simpleEncode('bar(uint256,uint256):(uint256)', index[2], num[2]),
            ];
            await this.proxy.batchExec(to, data);
            const result = [
                await this.foo0.accounts.call(this.proxy.address),
                await this.foo1.accounts.call(this.proxy.address),
                await this.foo2.accounts.call(this.proxy.address),
            ];
            expect(result[0]).to.be.bignumber.eq(num[0]);
            expect(result[1]).to.be.bignumber.eq(num[1]);
            expect(result[2]).to.be.bignumber.eq(num[2]);
        });
    });
});
