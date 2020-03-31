const { balance, BN, constants, ether, expectEvent, expectRevert, time } = require('@openzeppelin/test-helpers');
const { tracker } = balance;
const { latest } = time;
const abi = require('ethereumjs-abi');
const utils = web3.utils;

const { expect } = require('chai');

const { DAI_TOKEN, KYBERNETWORK_PROXY } = require('./utils/constants');
const { resetAccount } = require('./utils/utils');

const HKyberswap = artifacts.require('HKyberswap');
const Registry = artifacts.require('Registry');
const Proxy = artifacts.require('Proxy');
const IToken = artifacts.require('IERC20');
const IKyberNetworkProxy = artifacts.require('IKyberNetworkProxy');

contract('Swap', function ([_, deployer, user1, user2]) {
    const tokenAddress = DAI_TOKEN;

    let balanceUser1;
    let balanceUser2;
    let balanceProxy;

    before(async function () {
        this.registry = await Registry.new();
        this.proxy = await Proxy.new(this.registry.address);
        this.hkyberswap = await HKyberswap.new();
        await this.registry.register(this.hkyberswap.address, utils.asciiToHex("Kyberswap"));
        this.token = await IToken.at(tokenAddress);
        this.swap = await IKyberNetworkProxy.at(KYBERNETWORK_PROXY);
    });

    beforeEach(async function () {
        await resetAccount(_);
        await resetAccount(user1);
        await resetAccount(user2);
        balanceUser1 = await tracker(user1);
        balanceUser2 = await tracker(user2);
        balanceProxy = await tracker(this.proxy.address);
    });

    describe('Exact input', function () {
        it('normal', async function () {
            const value = [ether('1')];
            const to = [this.hkyberswap.address];
            const data = [
                abi.simpleEncode('swapEtherToToken(uint256,address,uint256):(uint256)', value[0], tokenAddress, new BN('1'))
            ];
/*
            const deadline = (await latest()).add(new BN('100'));
            const uniswapAmount = await this.swap.ethToTokenSwapInput.call(
                new BN('1'),
                deadline,
                { from: user1, value: ether('1') }
            );
*/
            //const rate = await this.swap.getExpectedRate.call('0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', tokenAddress, ether('1'));
            console.log(rate);
            const receipt = await this.proxy.batchExec(to, data, { from: user1, value: ether('1') });
/*
            expect(await this.token.balanceOf.call(user1)).to.be.bignumber.eq(uniswapAmount);
            expect(await this.token.balanceOf.call(this.proxy.address)).to.be.bignumber.eq(ether('0'));
            expect(await balanceProxy.delta()).to.be.bignumber.eq(ether('0'));
            expect(await balanceUser1.delta()).to.be.bignumber.eq(
                ether('0').sub(
                    ether('1')
                ).sub(
                    new BN(receipt.receipt.gasUsed)
                )
            );
*/
        });

/*
        it('min amount too high', async function () {
            const value = [ether('1')];
            const to = [this.huniswap.address];
            const deadline = (await latest()).add(new BN('100'));
            const uniswapAmount = await this.swap.ethToTokenSwapInput.call(
                new BN('1'),
                deadline,
                { from: user2, value: ether('1') }
            );
            const data = [
                abi.simpleEncode(
                    'ethToTokenSwapInput(uint256,address,uint256):(uint256)',
                    value[0],
                    tokenAddress,
                    uniswapAmount.add(ether('0.1'))
                )
            ];
            await expectRevert.unspecified(
                this.proxy.batchExec(to, data, { from: user2, value: ether('1') })
            );
            expect(await this.token.balanceOf.call(user2)).to.be.bignumber.eq(ether('0'));
            expect(await this.token.balanceOf.call(this.proxy.address)).to.be.bignumber.eq(ether('0'));
            expect(await balanceProxy.delta()).to.be.bignumber.eq(ether('0'));
        });
*/
    });
});
