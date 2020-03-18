const { balance, BN, constants, ether, expectEvent, expectRevert } = require('@openzeppelin/test-helpers');
const { tracker } = balance;
const abi = require('ethereumjs-abi');

const { expect } = require('chai');

const Foo = artifacts.require('Foo');
const FooFactory = artifacts.require('FooFactory');
const FooHandler = artifacts.require('FooHandler');
const Foo2 = artifacts.require('Foo2');
const Foo2Factory = artifacts.require('Foo2Factory');
const Foo2Handler = artifacts.require('Foo2Handler');
const Proxy = artifacts.require('ProxyMock');

async function resetAccount(account) {
    const ETHProvider = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e';
    const d = ether('100').sub(new BN(await web3.eth.getBalance(account)));
    if (d.isZero())
        return;
    else if (d.isNeg())
        await web3.eth.sendTransaction({ from: account, to: ETHProvider, value: d.neg() });
    else
        await web3.eth.sendTransaction({ from: ETHProvider, to: account, value: d });
}

contract('Proxy', function ([_, deployer, user1]) {
    beforeEach(async function () {
        await resetAccount(_);
        await resetAccount(user1);
    });

    let balanceUser1;
    let balanceProxy;

    before(async function () {
        this.proxy = await Proxy.new();
    });

    describe('execute', function () {
        before(async function () {
            this.fooFactory = await FooFactory.new({ from: deployer });
            expect(this.fooFactory.address).to.be.eq('0xb9A219631Aed55eBC3D998f17C3840B7eC39C0cc');
            await this.fooFactory.createFoo();
            await this.fooFactory.createFoo();
            this.foo0 = await Foo.at(await this.fooFactory.addressOf.call(0));
            this.foo1 = await Foo.at(await this.fooFactory.addressOf.call(1));
            this.foo2 = await Foo.at(await this.fooFactory.addressOf.call(2));
            this.fooHandler = await FooHandler.new();
        });

        it('single', async function () {
            const index = 0;
            const num = new BN('25');
            const data = abi.simpleEncode(
                'bar(uint256,uint256):(uint256)',
                index,
                num
            );
            await this.proxy.execMock(this.fooHandler.address, data);
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

    describe('execute with token', function () {
        before(async function () {
            this.fooFactory = await Foo2Factory.new({ from: deployer });
            expect(this.fooFactory.address).to.be.eq('0x4D2D24899c0B115a1fce8637FCa610Fe02f1909e');
            await this.fooFactory.createFoo();
            await this.fooFactory.createFoo();
            this.foo0 = await Foo2.at(await this.fooFactory.addressOf.call(0));
            this.foo1 = await Foo2.at(await this.fooFactory.addressOf.call(1));
            this.foo2 = await Foo2.at(await this.fooFactory.addressOf.call(2));
            this.fooHandler = await Foo2Handler.new();
        });

        beforeEach(async function () {
            balanceUser1 = await tracker(user1);
            balanceProxy = await tracker(this.proxy.address);
        });

        it('single', async function () {
            const index = 0;
            const to = this.fooHandler.address;
            const data = abi.simpleEncode('bar(uint256,uint256):(uint256)', ether('1'), index);
            await this.proxy.execMock(to, data, { value: ether('1') });
            expect(await balanceProxy.delta()).to.be.bignumber.eq(ether('0'));
            expect(await this.foo0.balanceOf.call(this.proxy.address)).to.be.bignumber.eq(ether('0'));
        });

        it('multiple', async function () {
            const index = [0, 1, 2];
            const value = [ether('0.1'), ether('0.2'), ether('0.5')];
            const to = [
                this.fooHandler.address,
                this.fooHandler.address,
                this.fooHandler.address,
            ];
            const data = [
                abi.simpleEncode('bar(uint256,uint256):(uint256)', value[0], index[0]),
                abi.simpleEncode('bar(uint256,uint256):(uint256)', value[1], index[1]),
                abi.simpleEncode('bar(uint256,uint256):(uint256)', value[2], index[2]),
            ];
            const receipt = await this.proxy.batchExec(to, data, { from: user1, value: ether('1') });
            expect(await balanceProxy.delta()).to.be.bignumber.eq(ether('0'));
            expect(await balanceUser1.delta()).to.be.bignumber.eq(
                ether('0').sub(
                    value[0].add(value[1]).add(value[2]).div(new BN('2'))
                ).sub(
                    new BN(receipt.receipt.gasUsed)
                )
            );
            expect(await this.foo0.balanceOf.call(this.proxy.address)).to.be.bignumber.eq(ether('0'));
            expect(await this.foo0.balanceOf.call(user1)).to.be.bignumber.eq(value[0].div(new BN('2')));
            expect(await this.foo1.balanceOf.call(this.proxy.address)).to.be.bignumber.eq(ether('0'));
            expect(await this.foo1.balanceOf.call(user1)).to.be.bignumber.eq(value[1].div(new BN('2')));
            expect(await this.foo2.balanceOf.call(this.proxy.address)).to.be.bignumber.eq(ether('0'));
            expect(await this.foo2.balanceOf.call(user1)).to.be.bignumber.eq(value[2].div(new BN('2')));
        });
    });
});
