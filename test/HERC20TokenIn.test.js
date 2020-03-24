const { balance, BN, constants, ether, expectEvent, expectRevert, time } = require('@openzeppelin/test-helpers');
const { tracker } = balance;
const { latest } = time;
const abi = require('ethereumjs-abi');
const utils = web3.utils;

const { expect } = require('chai');

const { DAI_TOKEN, DAI_UNISWAP, DAI_PROVIDER } = require('./utils/constants');
const { resetAccount } = require('./utils/utils');

const HERC20TokenIn = artifacts.require('HERC20TokenIn');
const Registry = artifacts.require('Registry');
const Proxy = artifacts.require('Proxy');
const IToken = artifacts.require('IERC20');

contract('ERC20TokenIn', function ([_, deployer, user1, someone]) {
    beforeEach(async function () {
        await resetAccount(_);
        await resetAccount(user1);
    });

    before(async function () {
        this.registry = await Registry.new();
        this.proxy = await Proxy.new(this.registry.address);
        this.herc20tokenin = await HERC20TokenIn.new();
        await this.registry.register(this.herc20tokenin.address, utils.asciiToHex("ERC20In"));
    });

    describe('DAI', function () {
        before(async function () {
            this.dai = await IToken.at(DAI_TOKEN);
        });

        it('normal', async function () {
            const value = [ether('100')];
            const to = [this.herc20tokenin.address];
            const data = [
                abi.simpleEncode('inject(address,uint256)', this.dai.address, value[0]),
            ];
            await this.dai.transfer(user1, value[0], { from: DAI_PROVIDER });
            await this.dai.approve(this.proxy.address, value[0], { from: user1 });

            const receipt = await this.proxy.batchExec(to, data, { from: user1 });

            await expectEvent.inTransaction(receipt.tx, this.dai, 'Transfer', {
                from: user1, to: this.proxy.address, value: value[0]
            });
            await expectEvent.inTransaction(receipt.tx, this.dai, 'Transfer', {
                from: this.proxy.address, to: user1, value: value[0]
            });
        });
    });
});
