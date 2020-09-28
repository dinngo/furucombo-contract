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
  DAI_TOKEN,
  DAI_PROVIDER,
  KNC_TOKEN,
  KNC_PROVIDER,
  STAKING_ADAPTER_REGISTRY,
  STAKING_ADAPTER_REGISTRY_OWNER,
  CREATE2_FACTORY,
  STAKING_REWARDS_ADAPTER_REGISTRY_SALT,
  STAKING_REWARDS_ADAPTER_REGISTRY,
  STAKING_REWARDS_ADAPTER_REGISTRY_BYTECODE
} = require('./utils/constants');
const { evmRevert, evmSnapshot, profileGas } = require('./utils/utils');

const Registry = artifacts.require('Registry');
const Proxy = artifacts.require('ProxyMock');
const HStakingRewardsAdapter = artifacts.require('HStakingRewardsAdapter');
const StakingRewards = artifacts.require('StakingRewards');
const StakingRewardsAdapter = artifacts.require('StakingRewardsAdapter');
const StakingRewardsAdapterFactory = artifacts.require(
  'StakingRewardsAdapterFactory'
);
const StakingRewardsAdapterRegistry = artifacts.require(
  'StakingRewardsAdapterRegistry'
);
const IToken = artifacts.require('IERC20');
const ISingletonFactory = artifacts.require('ISingletonFactory');

contract('Create2', function([_, user1, user2]) {
  let id;
  const bytecode = StakingRewardsAdapterRegistry.bytecode;
  console.log(`bytecode: ${bytecode}`);
  const salt = utils.asciiToHex('StakingRewardsAdapterRegistry');

  before(async function() {
    this.factory = await ISingletonFactory.at(CREATE2_FACTORY);
    console.log(`salt: ${salt}`);
  });

  beforeEach(async function() {
    id = await evmSnapshot();
  });

  afterEach(async function() {
    await evmRevert(id);
  });

  describe('contract address', function() {
    it('user0', async function() {
      const deployer = _;
      const receipt = await this.factory.deploy(bytecode, STAKING_REWARDS_ADAPTER_REGISTRY_SALT, { from: deployer });
      const log = receipt.receipt.rawLogs[1];
      console.log(`user0 topics: ${log.topics[0]}`);
      console.log(`user0 contract: ${log.address}`);
      console.log(`tx.origin: ${deployer}`);
    });

    it('user1', async function() {
      const deployer = user1;
      const receipt = await this.factory.deploy(bytecode, STAKING_REWARDS_ADAPTER_REGISTRY_SALT, {
        from: deployer,
      });
      const log = receipt.receipt.rawLogs[1];
      console.log(`user1 topics: ${log.topics[0]}`);
      console.log(`user1 contract: ${log.address}`);
      console.log(`tx.origin: ${deployer}`);
    });

    it('user2', async function() {
      const deployer = user2;
      const receipt = await this.factory.deploy(bytecode, STAKING_REWARDS_ADAPTER_REGISTRY_SALT, {
        from: deployer,
      });
      const log = receipt.receipt.rawLogs[1];
      console.log(`user2 topics: ${log.topics[0]}`);
      console.log(`user2 contract: ${log.address}`);
      console.log(`tx.origin: ${deployer}`);
    });
  });
});