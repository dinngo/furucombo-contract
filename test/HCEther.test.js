const { balance, BN, constants, ether, expectEvent, expectRevert, time } = require('@openzeppelin/test-helpers');
const { tracker } = balance;
const { latest } = time;
const abi = require('ethereumjs-abi');
const utils = web3.utils;

const { expect } = require('chai');

const { CETHER } = require('./utils/constants');
const { resetAccount } = require('./utils/utils');

const HCEther = artifacts.require('HCEther');
const Proxy = artifacts.require('Proxy');
const IToken = artifacts.require('IERC20');
const ICEther = artifacts.require('ICEther');

contract('CEther', function ([_, deployer, user1]) {
    beforeEach(async function () {
        await resetAccount(_);
        await resetAccount(user1);
    });

    before(async function () {
        this.proxy = await Proxy.new({ from: deployer });
        this.hcether = await HCEther.new({ from: deployer });
        this.cether = await ICEther.at(CETHER);
    });

    let balanceUser1;
    let balanceProxy;

    beforeEach(async function () {
        balanceUser1 = await tracker(user1);
        balanceProxy = await tracker(this.proxy.address);
    });

    describe('Mint', function () {
        it('normal', async function () {
            const value = [ether('0.1')];
            const to = [this.hcether.address];
            const data = [
                abi.simpleEncode('mint(uint256)', value[0]),
            ];
            const rate = await this.cether.exchangeRateCurrent.call();
            const result = ether('0.1').mul(ether('1')).div(rate);
            const receipt = await this.proxy.batchExec(to, data, { from: user1, value: ether('0.1') });
            const cetherUser1 = await this.cether.balanceOf.call(user1);
            expect(cetherUser1.mul(new BN('1000')).divRound(result)).to.be.bignumber.eq(new BN('1000'));
            expect(await balanceUser1.delta()).to.be.bignumber.eq(
                ether('0').sub(
                    ether('0.1')
                ).sub(
                    new BN(receipt.receipt.gasUsed)
                )
            );
        });
    });

});
