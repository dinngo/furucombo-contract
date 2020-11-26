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
const { latest } = time;
const abi = require('ethereumjs-abi');
const utils = web3.utils;

const { expect } = require('chai');

const {
  BALANCER_DAI_ETH,
  BALANCER_DAI_ETH_PROVIDER,
  COMBO_TOTAL_SUPPLY,
  COMBO_CLAIM_USER,
  COMBO_CLAIM_AMOUNT,
  COMBO_CLAIM_MERKLE_ROOT,
  COMBO_CLAIM_MERKLE_PROOFS,
} = require('./utils/constants');
const { evmRevert, evmSnapshot, profileGas } = require('./utils/utils');

const HFurucombo = artifacts.require('HFurucomboStaking');
const Registry = artifacts.require('Registry');
const Proxy = artifacts.require('ProxyMock');
const IToken = artifacts.require('IERC20');
const SimpleToken = artifacts.require('SimpleToken');
const Staking = artifacts.require('Staking');
const MerkleRedeem = artifacts.require('MerkleRedeem');

contract('Furucombo', function([_, user, someone]) {
  const tokenAddress = BALANCER_DAI_ETH;
  const providerAddress = BALANCER_DAI_ETH_PROVIDER;

  before(async function() {
    this.registry = await Registry.new();
    this.proxy = await Proxy.new(this.registry.address);
    this.hFurucombo = await HFurucombo.new();
    await this.registry.register(
      this.hFurucombo.address,
      utils.asciiToHex('Furucombo')
    );

    this.rewardToken = await SimpleToken.new();
    this.staking = await Staking.new(tokenAddress, this.rewardToken.address);
    this.stakingRedeem = await MerkleRedeem.at(await this.staking.redeemable());
    this.merkleRedeem = await MerkleRedeem.new(this.rewardToken.address);
    this.token = await IToken.at(tokenAddress);
  });

  beforeEach(async function() {
    id = await evmSnapshot();
  });

  afterEach(async function() {
    await evmRevert(id);
  });

  describe('stake', function() {
    beforeEach(async function() {
      balanceUser = await tracker(user);
      balanceProxy = await tracker(this.proxy.address);
    });

    it('normal', async function() {
      const stakeAmount = ether('100');
      const to = this.hFurucombo.address;
      const data = abi.simpleEncode(
        'stake(address,uint256)',
        this.staking.address,
        stakeAmount
      );

      // Send token to proxy
      await this.token.transfer(this.proxy.address, stakeAmount, {
        from: providerAddress,
      });
      await this.proxy.updateTokenMock(this.token.address);

      // Execute proxy handler
      await balanceUser.get();
      const receipt = await this.proxy.execMock(to, data, {
        from: user,
        value: ether('0.1'),
      });

      // Verify
      expect(await this.token.balanceOf.call(this.proxy.address)).to.be.zero;
      expect(await balanceProxy.get()).to.be.zero;
      expect(await this.token.balanceOf.call(user)).to.be.zero;
      expect(await balanceUser.delta()).to.be.bignumber.eq(
        ether('0').sub(new BN(receipt.receipt.gasUsed))
      );
      expect(await this.staking.balanceOf(user)).to.be.bignumber.eq(
        stakeAmount
      );

      // Verify event
      await expectEvent.inTransaction(receipt.tx, this.staking, 'Staked', {
        sender: this.proxy.address,
        onBehalfOf: user,
        amount: stakeAmount,
      });

      profileGas(receipt);
    });

    it('should revert: stake insufficient amount', async function() {
      const stakeAmount = ether('100');
      const to = this.hFurucombo.address;
      const data = abi.simpleEncode(
        'stake(address,uint256)',
        this.staking.address,
        stakeAmount
      );

      // Send token to proxy
      await this.token.transfer(this.proxy.address, ether('1'), {
        from: providerAddress,
      });
      await this.proxy.updateTokenMock(this.token.address);

      await expectRevert(
        this.proxy.execMock(to, data, {
          from: user,
          value: ether('0.1'),
        }),
        'SafeERC20: low-level call failed'
      );
    });

    it('should revert: stake zero amount', async function() {
      const stakeAmount = ether('0');
      const to = this.hFurucombo.address;
      const data = abi.simpleEncode(
        'stake(address,uint256)',
        this.staking.address,
        stakeAmount
      );

      // Send token to proxy
      await this.token.transfer(this.proxy.address, ether('1'), {
        from: providerAddress,
      });
      await this.proxy.updateTokenMock(this.token.address);

      await expectRevert(
        this.proxy.execMock(to, data, {
          from: user,
          value: ether('0.1'),
        }),
        'HFurucombo: stake amount = 0'
      );
    });
  });

  describe('unstake', function() {
    var stakeAmount;
    beforeEach(async function() {
      balanceUser = await tracker(user);
      balanceProxy = await tracker(this.proxy.address);
      await this.token.transfer(user, ether('1000'), {
        from: providerAddress,
      });

      //  Stake
      stakeAmount = ether('100');
      await this.token.approve(this.staking.address, stakeAmount, {
        from: user,
      });
      await this.staking.stake(stakeAmount, {
        from: user,
      });

      expect(await this.staking.balanceOf(user)).to.be.bignumber.eq(
        stakeAmount
      );
    });

    it('unstake partial stake amount', async function() {
      const unstakeAmount = ether('10');
      const to = this.hFurucombo.address;
      const data = abi.simpleEncode(
        'unstake(address,uint256)',
        this.staking.address,
        unstakeAmount
      );

      // Execute proxy handler
      await this.staking.setApproval(this.proxy.address, true, {
        from: user,
      });
      const tokenUserBefore = await this.token.balanceOf.call(user);
      await balanceUser.get();
      const receipt = await this.proxy.execMock(to, data, {
        from: user,
        value: ether('0.1'),
      });
      const tokenUserAfter = await this.token.balanceOf.call(user);

      // Verify
      expect(await this.token.balanceOf.call(this.proxy.address)).to.be.zero;
      expect(await balanceProxy.get()).to.be.zero;
      expect(tokenUserAfter.sub(tokenUserBefore)).to.be.bignumber.eq(
        unstakeAmount
      );
      expect(await this.staking.balanceOf(user)).to.be.bignumber.eq(
        stakeAmount.sub(unstakeAmount)
      );
      expect(await balanceUser.delta()).to.be.bignumber.eq(
        ether('0').sub(new BN(receipt.receipt.gasUsed))
      );

      // Verify event
      await expectEvent.inTransaction(receipt.tx, this.staking, 'Unstaked', {
        sender: this.proxy.address,
        onBehalfOf: user,
        amount: unstakeAmount,
      });

      profileGas(receipt);
    });

    it('unstake all stake amount', async function() {
      const unstakeAmount = stakeAmount;
      const to = this.hFurucombo.address;
      const data = abi.simpleEncode(
        'unstake(address,uint256)',
        this.staking.address,
        unstakeAmount
      );

      // Execute proxy handler
      await this.staking.setApproval(this.proxy.address, true, {
        from: user,
      });
      const tokenUserBefore = await this.token.balanceOf.call(user);
      await balanceUser.get();
      const receipt = await this.proxy.execMock(to, data, {
        from: user,
        value: ether('0.1'),
      });
      const tokenUserAfter = await this.token.balanceOf.call(user);

      // Verify
      expect(await this.token.balanceOf.call(this.proxy.address)).to.be.zero;
      expect(await balanceProxy.get()).to.be.zero;
      expect(tokenUserAfter.sub(tokenUserBefore)).to.be.bignumber.eq(
        unstakeAmount
      );
      expect(await this.staking.balanceOf(user)).to.be.zero;
      expect(await balanceUser.delta()).to.be.bignumber.eq(
        ether('0').sub(new BN(receipt.receipt.gasUsed))
      );

      // Verify event
      await expectEvent.inTransaction(receipt.tx, this.staking, 'Unstaked', {
        sender: this.proxy.address,
        onBehalfOf: user,
        amount: unstakeAmount,
      });

      profileGas(receipt);
    });

    it('should revert: unauthorized', async function() {
      const unstakeAmount = stakeAmount;
      const to = this.hFurucombo.address;
      const data = abi.simpleEncode(
        'unstake(address,uint256)',
        this.staking.address,
        unstakeAmount
      );

      // Execute proxy handler
      await expectRevert(
        this.proxy.execMock(to, data, {
          from: user,
          value: ether('0.1'),
        }),
        'Furucombo staking: agent is not approved'
      );
    });

    it('should revert: unstake amount = 0', async function() {
      const unstakeAmount = ether('0');
      const to = this.hFurucombo.address;
      const data = abi.simpleEncode(
        'unstake(address,uint256)',
        this.staking.address,
        unstakeAmount
      );

      // Execute proxy handler
      await expectRevert(
        this.proxy.execMock(to, data, {
          from: user,
          value: ether('0.1'),
        }),
        'HFurucombo: unstake amount = 0'
      );
    });
  });

  describe('claim all', function() {
    const funcABI = {
      constant: false,
      inputs: [
        {
          internalType: 'address',
          name: 'user',
          type: 'address',
        },
        {
          internalType: 'address[]',
          name: 'pools',
          type: 'address[]',
        },
        {
          components: [
            {
              internalType: 'uint256',
              name: 'week',
              type: 'uint256',
            },
            {
              internalType: 'uint256',
              name: 'balance',
              type: 'uint256',
            },
            {
              internalType: 'bytes32[]',
              name: 'merkleProof',
              type: 'bytes32[]',
            },
          ],
          internalType: 'struct IMerkleRedeem.Claim[][]',
          name: 'claims',
          type: 'tuple[][]',
        },
      ],
      name: 'claimAll',
      outputs: [],
      payable: true,
      stateMutability: 'payable',
      type: 'function',
    };

    var week;
    var supply;
    var root;

    beforeEach(async function() {
      balanceUser = await tracker(COMBO_CLAIM_USER);
      balanceProxy = await tracker(this.proxy.address);
      week = utils.toBN(1);
      supply = ether(COMBO_TOTAL_SUPPLY);
      root = COMBO_CLAIM_MERKLE_ROOT;

      // Update merkle root to merkleRedeem for retroactive contract
      await this.rewardToken.approve(this.merkleRedeem.address, supply, {
        from: _,
      });
      await this.merkleRedeem.seedAllocations(week, root, supply, {
        from: _,
      });
      expect(await this.merkleRedeem.weekMerkleRoots.call(week)).eq(root);

      // Update merkle root to merkleRedeem for staking contract
      await this.rewardToken.approve(this.stakingRedeem.address, supply, {
        from: _,
      });
      await this.stakingRedeem.seedAllocations(week, root, supply, {
        from: _,
      });
      expect(await this.stakingRedeem.weekMerkleRoots.call(week)).eq(root);

      // Send ether to claimUser
      await web3.eth.sendTransaction({
        from: _,
        to: COMBO_CLAIM_USER,
        value: 5,
      });
    });

    it('claim from the first week', async function() {
      const claimAmount = ether(COMBO_CLAIM_AMOUNT);
      const proofs = COMBO_CLAIM_MERKLE_PROOFS;
      const claimUser = COMBO_CLAIM_USER;
      const pools = [this.staking.address, this.merkleRedeem.address];
      const claims = [
        [[week.toString(), claimAmount.toString(), proofs]],
        [[week.toString(), claimAmount.toString(), proofs]],
      ];
      const to = this.hFurucombo.address;
      const data = utils.hexToBytes(
        web3.eth.abi.encodeFunctionCall(funcABI, [claimUser, pools, claims])
      );

      // Execute proxy handler
      const rewardUserBefore = await this.rewardToken.balanceOf.call(claimUser);
      await balanceUser.get();
      const receipt = await this.proxy.execMock(to, data, {
        from: claimUser,
        value: ether('0.1'),
      });
      const rewardUserAfter = await this.rewardToken.balanceOf.call(claimUser);

      // Verify
      expect(rewardUserAfter.sub(rewardUserBefore)).to.be.bignumber.eq(
        claimAmount.add(claimAmount)
      );
      expect(await balanceProxy.get()).to.be.zero;
      expect(
        await this.rewardToken.balanceOf.call(this.proxy.address)
      ).to.be.zero;
      expect(await balanceUser.delta()).to.be.bignumber.eq(
        ether('0').sub(new BN(receipt.receipt.gasUsed))
      );
      profileGas(receipt);
    });

    it('claim from the first + second week', async function() {
      // seed week2 allocation to staking contract
      const week2 = utils.toBN(2);
      await this.rewardToken.approve(this.stakingRedeem.address, supply, {
        from: _,
      });
      await this.stakingRedeem.seedAllocations(week2, root, supply, {
        from: _,
      });
      expect(await this.stakingRedeem.weekMerkleRoots.call(week2)).eq(root);

      // setup handler data
      const claimAmount = ether(COMBO_CLAIM_AMOUNT);
      const proofs = COMBO_CLAIM_MERKLE_PROOFS;
      const claimUser = COMBO_CLAIM_USER;
      const pools = [
        this.staking.address,
        this.merkleRedeem.address,
        this.staking.address,
      ];
      const claims = [
        [[week.toString(), claimAmount.toString(), proofs]],
        [[week.toString(), claimAmount.toString(), proofs]],
        [[week2.toString(), claimAmount.toString(), proofs]],
      ];
      const to = this.hFurucombo.address;
      const data = utils.hexToBytes(
        web3.eth.abi.encodeFunctionCall(funcABI, [claimUser, pools, claims])
      );

      // Execute proxy handler
      const rewardUserBefore = await this.rewardToken.balanceOf.call(claimUser);
      await balanceUser.get();
      const receipt = await this.proxy.execMock(to, data, {
        from: claimUser,
        value: ether('0.1'),
      });
      const rewardUserAfter = await this.rewardToken.balanceOf.call(claimUser);

      // verify
      expect(rewardUserAfter.sub(rewardUserBefore)).to.be.bignumber.eq(
        claimAmount.add(claimAmount).add(claimAmount)
      );
      expect(await balanceProxy.get()).to.be.zero;
      expect(
        await this.rewardToken.balanceOf.call(this.proxy.address)
      ).to.be.zero;
      expect(await balanceUser.delta()).to.be.bignumber.eq(
        ether('0').sub(new BN(receipt.receipt.gasUsed))
      );
      profileGas(receipt);
    });

    it('claim from other one', async function() {
      const claimAmount = ether(COMBO_CLAIM_AMOUNT);
      const proofs = COMBO_CLAIM_MERKLE_PROOFS;
      const claimUser = COMBO_CLAIM_USER;
      const pools = [this.staking.address, this.merkleRedeem.address];
      const claims = [
        [[week.toString(), claimAmount.toString(), proofs]],
        [[week.toString(), claimAmount.toString(), proofs]],
      ];
      const to = this.hFurucombo.address;
      const data = utils.hexToBytes(
        web3.eth.abi.encodeFunctionCall(funcABI, [claimUser, pools, claims])
      );

      // Execute proxy handler
      const rewardUserBefore = await this.rewardToken.balanceOf.call(claimUser);
      await balanceUser.get();
      const receipt = await this.proxy.execMock(to, data, {
        from: someone,
        value: ether('0.1'),
      });
      const rewardUserAfter = await this.rewardToken.balanceOf.call(claimUser);

      // verify
      expect(rewardUserAfter.sub(rewardUserBefore)).to.be.bignumber.eq(
        claimAmount.add(claimAmount)
      );
      expect(await balanceProxy.get()).to.be.zero;
      expect(
        await this.rewardToken.balanceOf.call(this.proxy.address)
      ).to.be.zero;
      expect(await balanceUser.delta()).to.be.zero;
      profileGas(receipt);
    });

    it('should revert: claim over reward', async function() {
      const claimAmount = ether('100');
      const proofs = COMBO_CLAIM_MERKLE_PROOFS;
      const claimUser = COMBO_CLAIM_USER;
      const pools = [this.staking.address];
      const claims = [[[week.toString(), claimAmount.toString(), proofs]]];
      const to = this.hFurucombo.address;
      const data = utils.hexToBytes(
        web3.eth.abi.encodeFunctionCall(funcABI, [claimUser, pools, claims])
      );

      // Execute proxy handler
      await expectRevert(
        this.proxy.execMock(to, data, {
          from: claimUser,
          value: ether('0.1'),
        }),
        'Incorrect merkle proof'
      );
    });

    it('should revert: claim less reward', async function() {
      const claimAmount = ether('1');
      const proofs = COMBO_CLAIM_MERKLE_PROOFS;
      const claimUser = COMBO_CLAIM_USER;
      const pools = [this.staking.address];
      const claims = [[[week.toString(), claimAmount.toString(), proofs]]];
      const to = this.hFurucombo.address;
      const data = utils.hexToBytes(
        web3.eth.abi.encodeFunctionCall(funcABI, [claimUser, pools, claims])
      );

      // Execute proxy handler
      await expectRevert(
        this.proxy.execMock(to, data, {
          from: claimUser,
          value: ether('0.1'),
        }),
        'Incorrect merkle proof'
      );
    });

    it('should revert: claim no reward', async function() {
      const claimAmount = ether('1');
      const proofs = COMBO_CLAIM_MERKLE_PROOFS;
      const claimUser = someone;
      const pools = [this.staking.address];
      const claims = [[[week.toString(), claimAmount.toString(), proofs]]];
      const to = this.hFurucombo.address;
      const data = utils.hexToBytes(
        web3.eth.abi.encodeFunctionCall(funcABI, [claimUser, pools, claims])
      );

      // Execute proxy handler
      await expectRevert(
        this.proxy.execMock(to, data, {
          from: claimUser,
          value: ether('0.1'),
        }),
        'Incorrect merkle proof'
      );
    });

    it('should revert: claim length is zero', async function() {
      const claimAmount = ether('1');
      const proofs = COMBO_CLAIM_MERKLE_PROOFS;
      const claimUser = someone;
      const pools = [this.staking.address];
      const claims = [];
      const to = this.hFurucombo.address;
      const data = utils.hexToBytes(
        web3.eth.abi.encodeFunctionCall(funcABI, [claimUser, pools, claims])
      );

      // Execute proxy handler
      await expectRevert(
        this.proxy.execMock(to, data, {
          from: claimUser,
          value: ether('0.1'),
        }),
        'HFurucombo: claims length = 0'
      );
    });

    it('should revert: claim length != pool length', async function() {
      const claimAmount = ether('100');
      const proofs = COMBO_CLAIM_MERKLE_PROOFS;
      const claimUser = COMBO_CLAIM_USER;
      const pools = [this.staking.address, this.staking.address];
      const claims = [[[week.toString(), claimAmount.toString(), proofs]]];
      const to = this.hFurucombo.address;
      const data = utils.hexToBytes(
        web3.eth.abi.encodeFunctionCall(funcABI, [claimUser, pools, claims])
      );

      // Execute proxy handler
      await expectRevert(
        this.proxy.execMock(to, data, {
          from: claimUser,
          value: ether('0.1'),
        }),
        'HFurucombo: pools length != claims length'
      );
    });
  });
});
