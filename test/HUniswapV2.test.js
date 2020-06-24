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
const { MAX_UINT256 } = constants;
const { latest } = time;
const abi = require('ethereumjs-abi');
const utils = web3.utils;
const { expect } = require('chai');
const {
  DAI_TOKEN,
  DAI_PROVIDER,
  BAT_TOKEN,
  WETH_TOKEN,
  UNISWAPV2_ROUTER02,
  UNISWAPV2_FACTORY,
} = require('./utils/constants');
const { resetAccount, profileGas } = require('./utils/utils');

const HUniswapV2 = artifacts.require('HUniswapV2');
const Registry = artifacts.require('Registry');
const Proxy = artifacts.require('ProxyMock');
const IToken = artifacts.require('IERC20');
const IUniswapV2Router = artifacts.require('IUniswapV2Router02');
const UniswapV2LibraryMock = artifacts.require('UniswapV2LibraryMock');

contract('UniswapV2 Swap', function([_, deployer, user, someone]) {
  before(async function() {
    this.registry = await Registry.new();
    this.huniswapv2 = await HUniswapV2.new();
    await this.registry.register(
      this.huniswapv2.address,
      utils.asciiToHex('UniswapV2')
    );
    this.uniswapLib = await UniswapV2LibraryMock.new();
    this.router = await IUniswapV2Router.at(UNISWAPV2_ROUTER02);
  });

  beforeEach(async function() {
    await resetAccount(_);
    await resetAccount(user);
    this.proxy = await Proxy.new(this.registry.address, { from: deployer });
  });

  describe('Ether to Token', function() {
    const tokenAddress = DAI_TOKEN;

    let balanceUser;
    let balanceProxy;
    let tokenUser;

    before(async function() {
      this.token = await IToken.at(tokenAddress);
    });

    beforeEach(async function() {
      balanceUser = await tracker(user);
      balanceProxy = await tracker(this.proxy.address);
      tokenUser = await this.token.balanceOf.call(user);
    });

    describe('Exact input', function() {
      it('normal', async function() {
        const value = ether('1');
        const to = this.huniswapv2.address;
        const path = [WETH_TOKEN, tokenAddress];
        const data = abi.simpleEncode(
          'swapExactETHForTokens(uint256,uint256,address[]):(uint256[])',
          value,
          new BN('1'),
          path
        );
        const result = await this.uniswapLib.getAmountsOut.call(
          UNISWAPV2_FACTORY,
          value,
          path,
          { from: someone }
        );
        console.log(`result[0]: ${web3.utils.fromWei(web3.utils.hexToNumberString(result[0]))}`);
        console.log(`result[1]: ${web3.utils.fromWei(web3.utils.hexToNumberString(result[1]))}`);

        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: value,
        });
        expect(await this.token.balanceOf.call(user)).to.be.bignumber.eq(
          tokenUser.add(result[result.length - 1])
        );
        expect(
          await this.token.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.eq(ether('0'));
        expect(await balanceProxy.delta()).to.be.bignumber.eq(ether('0'));
        expect(await balanceUser.delta()).to.be.bignumber.eq(
          ether('0')
            .sub(ether('1'))
            .sub(new BN(receipt.receipt.gasUsed))
        );
        profileGas(receipt);
      });

      it('min amount too high', async function() {
        const value = ether('1');
        const to = this.huniswapv2.address;
        const path = [WETH_TOKEN, tokenAddress];
        const result = await this.uniswapLib.getAmountsOut.call(
          UNISWAPV2_FACTORY,
          value,
          path,
          { from: someone }
        );
        const data = abi.simpleEncode(
          'swapExactETHForTokens(uint256,uint256,address[]):(uint256[])',
          value,
          result[result.length - 1].add(ether('0.1')),
          path
        );

        await expectRevert(
          this.proxy.execMock(to, data, { from: user, value: value }),
          'UniswapV2Router: INSUFFICIENT_OUTPUT_AMOUNT'
        );
        expect(await this.token.balanceOf.call(user)).to.be.bignumber.eq(
          tokenUser
        );
        expect(
          await this.token.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.eq(ether('0'));
        expect(await balanceProxy.delta()).to.be.bignumber.eq(ether('0'));
      });

      it('incorrect path', async function() {
        const value = ether('1');
        const to = this.huniswapv2.address;
        const path = [tokenAddress, WETH_TOKEN];
        const data = abi.simpleEncode(
          'swapExactETHForTokens(uint256,uint256,address[]):(uint256[])',
          value,
          new BN('1'),
          path
        );
        await expectRevert(
          this.proxy.execMock(to, data, { from: user, value: value }),
          'UniswapV2Router: INVALID_PATH'
        );
      });
    });

    describe('Exact output', function() {
      it('normal', async function() {
        const value = ether('1');
        const buyAmt = ether('100');
        const to = this.huniswapv2.address;
        const path = [WETH_TOKEN, tokenAddress];
        const data = abi.simpleEncode(
          'swapETHForExactTokens(uint256,uint256,address[]):(uint256[])',
          value,
          buyAmt,
          path
        );
        const result = await this.uniswapLib.getAmountsIn.call(
          UNISWAPV2_FACTORY,
          buyAmt,
          path,
          { from: someone }
        );
        const receipt = await this.proxy.execMock(to, data, {
          from: user,
          value: value,
        });
        expect(await this.token.balanceOf.call(user)).to.be.bignumber.eq(
          tokenUser.add(buyAmt)
        );
        expect(
          await this.token.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.eq(ether('0'));
        expect(await balanceProxy.delta()).to.be.bignumber.eq(ether('0'));
        expect(await balanceUser.delta()).to.be.bignumber.eq(
          ether('0')
            .sub(result[0])
            .sub(new BN(receipt.receipt.gasUsed))
        );
        profileGas(receipt);
      });

      it('insufficient ether', async function() {
        const buyAmt = ether('100');
        const to = this.huniswapv2.address;
        const path = [WETH_TOKEN, tokenAddress];
        const result = await this.uniswapLib.getAmountsIn.call(
          UNISWAPV2_FACTORY,
          buyAmt,
          path,
          { from: someone }
        );
        const value = result[0].sub(ether('0.01'));
        const data = abi.simpleEncode(
          'swapETHForExactTokens(uint256,uint256,address[]):(uint256[])',
          value,
          buyAmt,
          path
        );
        await expectRevert(
          this.proxy.execMock(to, data, {
            from: user,
            value:  value,
          }),
          'UniswapV2Router: EXCESSIVE_INPUT_AMOUNT.'
        );
      });

      it('incorrect path', async function() {
        const value = ether('1');
        const buyAmt = ether('100');
        const to = this.huniswapv2.address;
        const path = [tokenAddress, WETH_TOKEN];
        const data = abi.simpleEncode(
          'swapETHForExactTokens(uint256,uint256,address[]):(uint256[])',
          value,
          buyAmt,
          path
        );
        await expectRevert(
          this.proxy.execMock(to, data, {
            from: user,
            value:  value,
          }),
          'UniswapV2Router: INVALID_PATH'
        );
      });
    });
  });

  // describe('Token to Ether', function() {
  //   const tokenAddress = DAI_TOKEN;
  //   const uniswapAddress = DAI_UNISWAP;
  //   const providerAddress = DAI_PROVIDER;

  //   let balanceUser;
  //   let balanceProxy;
  //   let tokenUser;

  //   before(async function() {
  //     this.token = await IToken.at(tokenAddress);
  //     this.swap = await IUniswapExchange.at(uniswapAddress);
  //   });

  //   beforeEach(async function() {
  //     balanceUser = await tracker(user);
  //     balanceProxy = await tracker(this.proxy.address);
  //     tokenUser = await this.token.balanceOf(user);
  //   });

  //   describe('Exact input', function() {
  //     it('normal', async function() {
  //       const value = ether('100');
  //       const to = this.huniswapv2.address;
  //       const data = abi.simpleEncode(
  //         'tokenToEthSwapInput(address,uint256,uint256):(uint256)',
  //         tokenAddress,
  //         value,
  //         new BN('1')
  //       );
  //       await this.token.transfer(this.proxy.address, value, {
  //         from: providerAddress,
  //       });
  //       await this.proxy.updateTokenMock(this.token.address);
  //       await this.token.transfer(someone, value, { from: providerAddress });
  //       await this.token.approve(this.swap.address, value, {
  //         from: someone,
  //       });

  //       const deadline = (await latest()).add(new BN('100'));
  //       const result = await this.swap.tokenToEthSwapInput.call(
  //         value,
  //         new BN('1'),
  //         deadline,
  //         { from: someone }
  //       );
  //       const receipt = await this.proxy.execMock(to, data, { from: user });

  //       expect(await this.token.balanceOf.call(user)).to.be.bignumber.eq(
  //         tokenUser
  //       );
  //       expect(
  //         await this.token.balanceOf.call(this.proxy.address)
  //       ).to.be.bignumber.eq(ether('0'));
  //       expect(await balanceProxy.delta()).to.be.bignumber.eq(ether('0'));
  //       expect(await balanceUser.delta()).to.be.bignumber.eq(
  //         result.sub(new BN(receipt.receipt.gasUsed))
  //       );
  //       profileGas(receipt);
  //     });
  //   });

  //   describe('Exact output', function() {
  //     it('normal', async function() {
  //       const value = ether('100');
  //       const to = this.huniswapv2.address;
  //       const data = abi.simpleEncode(
  //         'tokenToEthSwapOutput(address,uint256,uint256):(uint256)',
  //         tokenAddress,
  //         ether('0.1'),
  //         value
  //       );
  //       await this.token.transfer(this.proxy.address, value, {
  //         from: providerAddress,
  //       });
  //       await this.proxy.updateTokenMock(this.token.address);
  //       await this.token.transfer(someone, value, { from: providerAddress });
  //       await this.token.approve(this.swap.address, value, {
  //         from: someone,
  //       });

  //       const deadline = (await latest()).add(new BN('100'));
  //       const result = await this.swap.tokenToEthSwapOutput.call(
  //         ether('0.1'),
  //         value,
  //         deadline,
  //         { from: someone }
  //       );
  //       const receipt = await this.proxy.execMock(to, data, {
  //         from: user,
  //       });
  //       expect(await this.token.balanceOf.call(user)).to.be.bignumber.eq(
  //         tokenUser.add(value).sub(result)
  //       );
  //       expect(
  //         await this.token.balanceOf.call(this.proxy.address)
  //       ).to.be.bignumber.eq(ether('0'));
  //       expect(await balanceProxy.delta()).to.be.bignumber.eq(ether('0'));
  //       expect(await balanceUser.delta()).to.be.bignumber.eq(
  //         ether('0.1').sub(new BN(receipt.receipt.gasUsed))
  //       );
  //       profileGas(receipt);
  //     });
  //   });
  // });

// 以下已完成
  describe('Token to Token', function() {
    const token0Address = DAI_TOKEN;
    const token1Address = BAT_TOKEN;
    const providerAddress = DAI_PROVIDER;

    let token0User;
    let token1User;

    before(async function() {
      this.token0 = await IToken.at(token0Address);
      this.token1 = await IToken.at(token1Address);
    });

    beforeEach(async function() {
      token0User = await this.token0.balanceOf.call(user);
      token1User = await this.token1.balanceOf.call(user);
    });

    describe('Exact input', function() {
      it('normal', async function() {
        const value = ether('100');
        const to = this.huniswapv2.address;
        const path = [token0Address, WETH_TOKEN, token1Address];
        const data = abi.simpleEncode(
          'swapExactTokensForTokens(uint256,uint256,address[]):(uint256[])',
          value,
          new BN('1'),
          path
        );
        await this.token0.transfer(this.proxy.address, value, {
          from: providerAddress,
        });
        await this.proxy.updateTokenMock(this.token0.address);
        await this.token0.transfer(someone, value, {
          from: providerAddress,
        });
        await this.token0.approve(this.router.address, value, {
          from: someone,
        });

        const result = await this.uniswapLib.getAmountsOut.call(
          UNISWAPV2_FACTORY,
          value,
          path,
          { from: someone }
        );
        console.log(`result[0]: ${web3.utils.fromWei(web3.utils.hexToNumberString(result[0]))}`);
        console.log(`result[1]: ${web3.utils.fromWei(web3.utils.hexToNumberString(result[1]))}`);
        console.log(`result[2]: ${web3.utils.fromWei(web3.utils.hexToNumberString(result[2]))}`);
        const receipt = await this.proxy.execMock(to, data, { from: user });

        expect(await this.token0.balanceOf.call(user)).to.be.bignumber.eq(
          token0User
        );
        expect(
          await this.token0.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.eq(ether('0'));
        expect(
          await this.token1.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.eq(ether('0'));
        expect(await this.token1.balanceOf.call(user)).to.be.bignumber.eq(
          token1User.add(result[result.length - 1])
        );
        
        profileGas(receipt);
      });
    });

    describe('Exact output', function() {
      it('normal', async function() {
        const value = ether('100');
        const buyAmt = ether('1');
        const to = this.huniswapv2.address;
        const path = [token0Address, WETH_TOKEN, token1Address];
        const data = abi.simpleEncode(
          'swapTokensForExactTokens(uint256,uint256,address[]):(uint256[])',
          buyAmt,
          value,
          path,
        );
        await this.token0.transfer(this.proxy.address, value, {
          from: providerAddress,
        });
        await this.proxy.updateTokenMock(this.token0.address);
        await this.token0.transfer(someone, value, {
          from: providerAddress,
        });
        await this.token0.approve(this.router.address, value, {
          from: someone,
        });

        const result = await this.uniswapLib.getAmountsIn.call(
          UNISWAPV2_FACTORY,
          buyAmt,
          path,
          { from: someone }
        );
        console.log(`result[0]: ${web3.utils.fromWei(web3.utils.hexToNumberString(result[0]))}`);
        console.log(`result[1]: ${web3.utils.fromWei(web3.utils.hexToNumberString(result[1]))}`);
        console.log(`result[2]: ${web3.utils.fromWei(web3.utils.hexToNumberString(result[2]))}`);
        const receipt = await this.proxy.execMock(to, data, {
          from: user,
        });
        expect(await this.token0.balanceOf.call(user)).to.be.bignumber.eq(
          token0User.add(value).sub(result[0])
        );
        expect(
          await this.token0.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.eq(ether('0'));
        expect(
          await this.token1.balanceOf.call(this.proxy.address)
        ).to.be.bignumber.eq(ether('0'));
        expect(await this.token1.balanceOf.call(user)).to.be.bignumber.eq(
          token1User.add(buyAmt)
        );
        profileGas(receipt);
      });
    });
  });
});
