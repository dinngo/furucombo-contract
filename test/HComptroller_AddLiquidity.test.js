const {
  balance,
  BN,
  constants,
  ether,
  time,
} = require('@openzeppelin/test-helpers');
const { tracker } = balance;
const { ZERO_BYTES32 } = constants;
const { duration, increase } = time;
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
const { evmRevert, evmSnapshot, profileGas } = require('./utils/utils');

const HFunds = artifacts.require('HFunds');
const HComptroller = artifacts.require('HComptroller');
const HUniswapV2 = artifacts.require('HUniswapV2');
const Registry = artifacts.require('Registry');
const Proxy = artifacts.require('ProxyMock');
const IToken = artifacts.require('IERC20');
const ICEther = artifacts.require('ICEther');
const IComptroller = artifacts.require('IComptroller');

contract('Claim Comp and add liquidity', function([
  _,
  deployer,
  user,
  someone,
]) {
  const tokenAddresses = [COMP_TOKEN];
  const values = [new BN('10000')];
  let id;
  let balanceUser;
  let balanceProxy;
  let compUser;

  before(async function() {
    this.registry = await Registry.new();
    this.proxy = await Proxy.new(this.registry.address);
    this.hComptroller = await HComptroller.new();
    await this.registry.register(
      this.hComptroller.address,
      utils.asciiToHex('Comptroller')
    );
    this.cEther = await ICEther.at(CETHER);
    this.comp = await IToken.at(tokenAddresses[0]);
    this.comptroller = await IComptroller.at(COMPOUND_COMPTROLLER);
  });

  beforeEach(async function() {
    id = await evmSnapshot();
    balanceUser = await tracker(user);
    balanceProxy = await tracker(this.proxy.address);
    await this.cEther.mint({
      from: user,
      value: ether('10'),
    });
    await increase(duration.days(1));
    compUser = await this.comp.balanceOf.call(user);
  });

  afterEach(async function() {
    await evmRevert(id);
  });

  // NOTE: Because COMP Hack event, compound stop to issue $COMP now.
  // Remove `skip` when compound issue $COMP again.
  describe.skip('UniswapV2 Liquidity', function() {
    const uniswapV2RouterAddress = UNISWAPV2_ROUTER02;
    before(async function() {
      this.hFunds = await HFunds.new();
      await this.registry.register(
        this.hFunds.address,
        utils.asciiToHex('ERC20In')
      );
      this.hUniswapV2 = await HUniswapV2.new();
      await this.registry.register(
        this.hUniswapV2.address,
        utils.asciiToHex('UniswapV2')
      );
      this.uniCompEth = await IToken.at(UNISWAPV2_ETH_COMP);
    });

    it('add liquidity', async function() {
      const value = ether('1');
      await this.comp.approve(this.proxy.address, values[0], {
        from: user,
      });
      const to = [
        this.hComptroller.address,
        this.hFunds.address,
        this.hUniswapV2.address,
      ];
      const config = [ZERO_BYTES32, ZERO_BYTES32, ZERO_BYTES32];
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

      const receipt = await this.proxy.batchExec(to, config, data, {
        from: user,
        value: ether('1'),
      });
      expect(await this.uniCompEth.balanceOf.call(user)).to.be.bignumber.gt(
        ether('0')
      );
    });
  });
});
