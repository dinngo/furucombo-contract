const { balance, BN, constants, ether, expectEvent, expectRevert, time } = require('@openzeppelin/test-helpers');
const { tracker } = balance;
const { latest } = time;
const abi = require('ethereumjs-abi');
const utils = web3.utils;

const { expect } = require('chai');

const { DAI_TOKEN, DAI_UNISWAP, DAI_PROVIDER } = require('./utils/constants');
const { resetAccount } = require('./utils/utils');

const HUniswap = artifacts.require('HUniswap_2');
const Registry = artifacts.require('Registry');
const Proxy = artifacts.require('Proxy');
const IToken = artifacts.require('IERC20');
const IUniswapExchange = artifacts.require('IUniswapExchange');

contract('Swap', function ([_, deployer, user1, user2, someone]) {
    beforeEach(async function () {
        await resetAccount(_);
        await resetAccount(user1);
        await resetAccount(user2);
    });

    before(async function () {
        this.registry = await Registry.new();
        this.proxy = await Proxy.new(this.registry.address);
        this.huniswap = await HUniswap.new();
        await this.registry.register(this.huniswap.address, utils.asciiToHex("Uniswap"));
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

        describe('DAI', function () {
            before(async function () {
                this.dai = await IToken.at(DAI_TOKEN);
                this.daiswap = await IUniswapExchange.at(DAI_UNISWAP);
            });

            it('normal', async function () {
                const value = [ether('100')];
                const to = [this.huniswap.address];
                const data = [
                    abi.simpleEncode('tokenToEthSwapInput(address,uint256,uint256):(uint256)', DAI_TOKEN, value[0], new BN('1'))
                ];
                await this.dai.transfer(this.proxy.address, value[0], { from: DAI_PROVIDER });
                await this.dai.transfer(someone, value[0], { from: DAI_PROVIDER });
                await this.dai.approve(this.daiswap.address, value[0], { from: someone });

                const deadline = (await latest()).add(new BN('100'));
                const result = await this.daiswap.tokenToEthSwapInput.call(
                    value[0],
                    new BN('1'),
                    deadline,
                    { from: someone }
                );
                const receipt = await this.proxy.batchExec(to, data, { from: user1 });

                expect(await this.dai.balanceOf.call(user1)).to.be.bignumber.eq(ether('0'));
                expect(await this.dai.balanceOf.call(this.proxy.address)).to.be.bignumber.eq(ether('0'));
                expect(await balanceProxy.delta()).to.be.bignumber.eq(ether('0'));
                expect(await balanceUser1.delta()).to.be.bignumber.eq(
                    result.sub(
                        new BN(receipt.receipt.gasUsed)
                    )
                );
            });
        });
    });
});
