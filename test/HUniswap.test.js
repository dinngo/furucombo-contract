const { balance, BN, constants, ether, expectEvent, expectRevert, time } = require('@openzeppelin/test-helpers');
const { tracker } = balance;
const { latest } = time;
const abi = require('ethereumjs-abi');
const utils = web3.utils;

const { expect } = require('chai');

const { DAI_TOKEN, DAI_UNISWAP } = require('./utils/constants');
const { resetAccount } = require('./utils/utils');

const HUniswap = artifacts.require('HUniswap');
const Proxy = artifacts.require('Proxy');
const IToken = artifacts.require('IERC20');
const IUniswapExchange = artifacts.require('IUniswapExchange');

contract('Swap', function ([_, deployer, user1, user2]) {
    beforeEach(async function () {
        await resetAccount(_);
        await resetAccount(user1);
        await resetAccount(user2);
    });

    before(async function () {
        this.proxy = await Proxy.new({ from: deployer });
        this.huniswap = await HUniswap.new({ from: deployer });
        this.dai = await IToken.at(DAI_TOKEN);
        this.daiswap = await IUniswapExchange.at(DAI_UNISWAP);
    });

    describe('Exact input', function () {
        let balanceUser1;
        let balanceUser2;
        let balanceProxy;

        beforeEach(async function () {
            balanceUser1 = await tracker(user1);
            balanceUser2 = await tracker(user2);
            balanceProxy = await tracker(this.proxy.address);
        });

        it('normal', async function () {
            const value = [ether('1')];
            const to = [this.huniswap.address];
            const data = [
                abi.simpleEncode('ethToTokenSwapInput(uint256,address,uint256):(uint256)', value[0], DAI_TOKEN, new BN('1'))
            ];
            const deadline = (await latest()).add(new BN('100'));
            const uniswapAmount = await this.daiswap.ethToTokenSwapInput.call(
                new BN('1'),
                deadline,
                { from: user1, value: ether('1') }
            );
            const receipt = await this.proxy.batchExec(to, data, { from: user1, value: ether('1') });
            expect(await this.dai.balanceOf.call(user1)).to.be.bignumber.eq(uniswapAmount);
            expect(await this.dai.balanceOf.call(this.proxy.address)).to.be.bignumber.eq(ether('0'));
            expect(await balanceProxy.delta()).to.be.bignumber.eq(ether('0'));
            expect(await balanceUser1.delta()).to.be.bignumber.eq(
                ether('0').sub(
                    ether('1')
                ).sub(
                    new BN(receipt.receipt.gasUsed)
                )
            );
        });

        it('min amount too high', async function () {
            const value = [ether('1')];
            const to = [this.huniswap.address];
            const deadline = (await latest()).add(new BN('100'));
            const uniswapAmount = await this.daiswap.ethToTokenSwapInput.call(
                new BN('1'),
                deadline,
                { from: user2, value: ether('1') }
            );
            const data = [
                abi.simpleEncode(
                    'ethToTokenSwapInput(uint256,address,uint256):(uint256)',
                    value[0],
                    DAI_TOKEN,
                    uniswapAmount.add(ether('0.1'))
                )
            ];
            await expectRevert.unspecified(
                this.proxy.batchExec(to, data, { from: user2, value: ether('1') })
            );
            expect(await this.dai.balanceOf.call(user2)).to.be.bignumber.eq(ether('0'));
            expect(await this.dai.balanceOf.call(this.proxy.address)).to.be.bignumber.eq(ether('0'));
            expect(await balanceProxy.delta()).to.be.bignumber.eq(ether('0'));
            //should get user gas usage
            //expect(await balanceUser2.delta()).to.be.bignumber.eq(ether('0'));
        });
    });
});
