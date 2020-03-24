const { balance, BN, constants, ether, expectEvent, expectRevert, time } = require('@openzeppelin/test-helpers');
const { tracker } = balance;
const { latest } = time;
const abi = require('ethereumjs-abi');
const utils = web3.utils;

const { expect } = require('chai');

const { CDAI, DAI_TOKEN, DAI_PROVIDER } = require('./utils/constants');
const { resetAccount } = require('./utils/utils');

const HCToken = artifacts.require('HCToken');
const Registry = artifacts.require('Registry');
const Proxy = artifacts.require('ProxyMock');
const IToken = artifacts.require('IERC20');
const ICToken = artifacts.require('ICToken');

contract('CToken', function ([_, deployer, user1]) {
    beforeEach(async function () {
        await resetAccount(_);
        await resetAccount(user1);
    });

    before(async function () {
        this.registry = await Registry.new();
        this.proxy = await Proxy.new(this.registry.address);
        this.hctoken = await HCToken.new();
        await this.registry.register(this.hctoken.address, utils.asciiToHex("CToken"));
    });

    let balanceUser1;
    let balanceProxy;

    beforeEach(async function () {
        balanceUser1 = await tracker(user1);
        balanceProxy = await tracker(this.proxy.address);
    });

    describe('cDAI', function () {
        before(async function () {
            this.dai = await IToken.at(DAI_TOKEN);
            this.cdai = await ICToken.at(CDAI);
        });

        describe('Mint', function () {
            it('normal', async function () {
                const value = [ether('10')];
                const to = [this.hctoken.address];
                const data = [
                    abi.simpleEncode('mint(address,uint256)', CDAI, value[0]),
                ];
                await this.dai.transfer(this.proxy.address, value[0], { from: DAI_PROVIDER });

                const rate = await this.cdai.exchangeRateStored.call();
                const result = value[0].mul(ether('1')).div(rate);
                const receipt = await this.proxy.batchExec(to, data, { from: user1 });
                const cdaiUser1 = await this.cdai.balanceOf.call(user1);
                expect(cdaiUser1.mul(new BN('1000')).divRound(result)).to.be.bignumber.eq(new BN('1000'));
                expect(await balanceUser1.delta()).to.be.bignumber.eq(
                    ether('0').sub(
                        new BN(receipt.receipt.gasUsed)
                    )
                );
            });
        });
    });
});
