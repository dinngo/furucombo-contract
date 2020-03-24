const { balance, BN, constants, ether, expectEvent, expectRevert, time } = require('@openzeppelin/test-helpers');
const { tracker } = balance;
const { latest } = time;
const abi = require('ethereumjs-abi');
const utils = web3.utils;

const { expect } = require('chai');

const { DAI_TOKEN, DAI_UNISWAP, DAI_PROVIDER, ETH_PROVIDER } = require('./utils/constants');
const { resetAccount } = require('./utils/utils');

const HUniswap = artifacts.require('HUniswap');
const HUniswap_2 = artifacts.require('HUniswap_2');
const Registry = artifacts.require('Registry');
const Proxy = artifacts.require('Proxy');
const IToken = artifacts.require('IERC20');
const IUniswapExchange = artifacts.require('IUniswapExchange');

contract('Liquidity', function ([_, deployer, user1, user2]) {
    beforeEach(async function () {
        await resetAccount(_);
        await resetAccount(user1);
        await resetAccount(user2);
    });

    before(async function () {
        this.registry = await Registry.new();
        this.proxy = await Proxy.new(this.registry.address);
        this.huniswap = await HUniswap.new();
        this.huniswap_2 = await HUniswap_2.new();
        await this.registry.register(this.huniswap.address, utils.asciiToHex("Uniswap"));
        await this.registry.register(this.huniswap_2.address, utils.asciiToHex("Uniswap_2"));
        this.dai = await IToken.at(DAI_TOKEN);
        this.daiswap = await IUniswapExchange.at(DAI_UNISWAP);
        await this.dai.transfer(user1, ether('1000'), { from: DAI_PROVIDER });
    });

    let balanceUser1;
    let balanceUser2;
    let balanceProxy;

    beforeEach(async function () {
        balanceUser1 = await tracker(user1);
        balanceUser2 = await tracker(user2);
        balanceProxy = await tracker(this.proxy.address);
    });

    describe('Add', function () {
        beforeEach(async function () {
            await this.dai.transfer(this.proxy.address, ether('100'), { from: user1 });
        });

        it('normal', async function () {
            const value = [ether('0.1')];
            const to = [this.huniswap.address];
            const data = [
                abi.simpleEncode('addLiquidity(uint256,address,uint256):(uint256)', value[0], DAI_TOKEN, ether('100'))
            ];
            const deadline = (await latest()).add(new BN('100'));
            await this.dai.approve(this.daiswap.address, ether('1000'), { from: user1 });
            const result = await this.daiswap.addLiquidity.call(
                new BN('1'),
                ether('100'),
                deadline,
                { from: user1, value: ether('0.1') }
            );
            const receipt = await this.proxy.batchExec(to, data, { from: user1, value: ether('0.1') });

            expect(await balanceUser1.delta()).to.be.bignumber.lt(ether('0'));
            expect(await this.daiswap.balanceOf.call(user1)).to.be.bignumber.eq(result);
        });
    });

    describe('Remove', function () {
        let uniAmount;
        let deadline;
        beforeEach(async function () {
            await this.dai.transfer(user2, ether('100'), { from: DAI_PROVIDER });
            await this.dai.approve(this.daiswap.address, ether('1000'), { from: user2 });
            deadline = (await latest()).add(new BN('100'));
            await this.daiswap.addLiquidity(
                new BN('1'),
                ether('100'),
                deadline,
                { from: user2, value: ether('0.1') }
            );
            uniAmount = await this.daiswap.balanceOf.call(user2);
        });

        it('normal', async function () {
            const value = [uniAmount];
            const to = [this.huniswap_2.address];
            const data = [
                abi.simpleEncode(
                    'removeLiquidity(address,uint256,uint256,uint256):(uint256,uint256)',
                    DAI_TOKEN,
                    value[0],
                    new BN('1'),
                    new BN('1')
                ),
            ];
            await this.daiswap.approve(this.daiswap.address, uniAmount, { from: user2 });
            const result = await this.daiswap.removeLiquidity.call(
                uniAmount,
                new BN('1'),
                new BN('1'),
                deadline,
                { from: user2 }
            );
            await this.daiswap.transfer(this.proxy.address, uniAmount, { from: user2 });
            await balanceUser2.get();
            const daiUser2 = await this.dai.balanceOf.call(user2);
            const receipt = await this.proxy.batchExec(to, data, { from: user2 });
            const daiUser2Delta = (await this.dai.balanceOf.call(user2)).sub(daiUser2);
            const balanceUser2Delta = await balanceUser2.delta();

            // Need to clean proxy dai to get correct value
            //expect(daiUser2Delta).to.be.bignumber.eq(result['1']);
            expect(balanceUser2Delta).to.be.bignumber.eq(result['0'].sub(new BN(receipt.receipt.gasUsed)));
        });
    });
});
