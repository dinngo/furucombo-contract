const {
  balance,
  BN,
  constants,
  ether,
  expectEvent,
  expectRevert,
  time,
} = require('@openzeppelin/test-helpers');
const { tracker } = balance;
const { duration, increase, latest } = time;
const abi = require('ethereumjs-abi');
const utils = web3.utils;

const { expect } = require('chai');

const {
  CETHER,
  COMP_TOKEN,
  COMPOUND_COMPTROLLER,
  COMPOUND_LENS,
  UNISWAPV2_ETH_COMP,
  UNISWAPV2_ROUTER02,
} = require('./utils/constants');
const { resetAccount, profileGas } = require('./utils/utils');

const HERC20TokenIn = artifacts.require('HERC20TokenIn');
const HComptroller = artifacts.require('HComptroller');
const HUniswapV2 = artifacts.require('HUniswapV2');
const Registry = artifacts.require('Registry');
const Proxy = artifacts.require('ProxyMock');
const IToken = artifacts.require('IERC20');
const ICEther = artifacts.require('ICEther');
const IComptroller = artifacts.require('IComptroller');

async function getEstimatedComp(account) {
  const data = web3.eth.abi.encodeFunctionCall(
    {
      constant: false,
      inputs: [
        { name: 'comp', type: 'address' },
        {
          name: 'comptroller',
          type: 'address',
        },
        { name: 'account', type: 'address' },
      ],
      name: 'getCompBalanceMetadataExt',
      payable: false,
      stateMutability: 'nonpayable',
      type: 'function',
    },
    [COMP_TOKEN, COMPOUND_COMPTROLLER, account]
  );
  const result = await web3.eth.call({
    from: account,
    to: COMPOUND_LENS,
    data: data,
  });
  const d = web3.eth.abi.decodeParameters(
    ['uint256', 'uint256', 'address', 'uint256'],
    result
  );
  return d['3'];
}

contract('Claim Comp and add liquidity', function([
  _,
  deployer,
  user,
  someone,
]) {
  const tokenAddresses = [COMP_TOKEN];
  const values = [new BN('10000')];
  let balanceUser;
  let balanceProxy;
  let compUser;

  before(async function() {
    this.registry = await Registry.new();
    this.proxy = await Proxy.new(this.registry.address);
    this.hcomptroller = await HComptroller.new();
    await this.registry.register(
      this.hcomptroller.address,
      utils.asciiToHex('Comptroller')
    );
    this.cether = await ICEther.at(CETHER);
    this.comp = await IToken.at(tokenAddresses[0]);
    this.comptroller = await IComptroller.at(COMPOUND_COMPTROLLER);
  });

  beforeEach(async function() {
    await resetAccount(_);
    await resetAccount(user);
    balanceUser = await tracker(user);
    balanceProxy = await tracker(this.proxy.address);
    await this.cether.mint({
      from: user,
      value: ether('10'),
    });
    await increase(duration.days(1));
    compUser = await this.comp.balanceOf.call(user);
  });

  describe('UniswapV2 Liquidity', function() {
    const uniswapV2RouterAddress = UNISWAPV2_ROUTER02;
    before(async function() {
      this.herc20tokenin = await HERC20TokenIn.new();
      await this.registry.register(
        this.herc20tokenin.address,
        utils.asciiToHex('ERC20In')
      );
      this.huniswapv2 = await HUniswapV2.new();
      await this.registry.register(
        this.huniswapv2.address,
        utils.asciiToHex('UniswapV2')
      );
      this.uniCOMPETH = await IToken.at(UNISWAPV2_ETH_COMP);
    });

    it('add liquidity', async function() {
      const value = ether('1');
      await this.comp.approve(this.proxy.address, values[0], {
        from: user,
      });
      const to = [
        this.hcomptroller.address,
        this.herc20tokenin.address,
        this.huniswapv2.address,
      ];
      const data = [
        abi.simpleEncode('claimComp()'),
        abi.simpleEncode('inject(address[],uint256[])', tokenAddresses, values),
        abi.simpleEncode(
          'addLiquidityETH(uint256,address,uint256,uint256,uint256):(uint256,uint256,uint256)',
          value,
          tokenAddresses[0],
          values[0],
          new BN('1'),
          new BN('1')
        ),
      ];
      const receipt = await this.proxy.batchExec(to, data, {
        from: user,
        value: ether('1'),
      });
      expect(await this.uniCOMPETH.balanceOf.call(user)).to.be.bignumber.gt(
        ether('0')
      );
    });
  });
});
