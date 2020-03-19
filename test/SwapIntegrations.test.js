const { balance, BN, constants, ether, expectEvent, expectRevert, time } = require('@openzeppelin/test-helpers');
const { tracker } = balance;
const { latest } = time;
const abi = require('ethereumjs-abi');
const utils = web3.utils;

const { expect } = require('chai');

const { DAI_TOKEN, DAI_UNISWAP, DAI_PROVIDER, ETH_PROVIDER } = require('./utils/constants');
const { resetAccount } = require('./utils/utils');

const HUniswap = artifacts.require('HUniswap');
const Proxy = artifacts.require('Proxy');
const IToken = artifacts.require('IERC20');
const IUniswapExchange = artifacts.require('IUniswapExchange');

contract('SwapIntegration', function ([_, deployer, user1]) {
    beforeEach(async function () {
        await resetAccount(_);
        await resetAccount(user1);
    });

    before(async function () {
        this.proxy = await Proxy.new({ from: deployer });
    });

    let balanceUser1;
    let balanceProxy;

    beforeEach(async function () {
        balanceUser1 = await tracker(user1);
        balanceProxy = await tracker(this.proxy.address);
    })

    describe('Uniswap Swap', function () {
        before(async function () {
            this.huniswap = await HUniswap.new({ from: deployer });
        });

        describe('Uniswap Addliquidity', function () {
            describe('DAI', function () {
                before(async function () {
                    this.dai = await IToken.at(DAI_TOKEN);
                    this.daiswap = await IUniswapExchange.at(DAI_UNISWAP);
                });

                it('normal', async function () {
                    const value = [
                        ether('0.505'),
                        ether('0.495'),
                    ];
                    const deadline = (await latest()).add(new BN('100'));
                    const maxToken = await this.daiswap.ethToTokenSwapInput.call(
                        new BN('1'),
                        deadline,
                        { from: user1, value: value[0] }
                    );
                    const to = [
                        this.huniswap.address,
                        this.huniswap.address,
                    ];
                    const data = [
                        abi.simpleEncode(
                            'ethToTokenSwapInput(uint256,address,uint256):(uint256)',
                            value[0],
                            DAI_TOKEN,
                            new BN('1')
                        ),
                        abi.simpleEncode(
                            'addLiquidity(uint256,address,uint256):(uint256)',
                            value[1],
                            DAI_TOKEN,
                            maxToken
                        ),
                    ];
                    const receipt = await this.proxy.batchExec(to, data, { from: user1, value: ether('1') });
                    expect(await balanceUser1.delta()).to.be.bignumber.eq(
                        ether('0').sub(
                            ether('0.505')
                        ).sub(
                            ether('0.495')
                        ).sub(
                            new BN(receipt.receipt.gasUsed)
                        )
                    );
                    expect(await this.daiswap.balanceOf.call(user1)).to.be.bignumber.gt(ether('0'));
                });
            });
        });
    });
});
