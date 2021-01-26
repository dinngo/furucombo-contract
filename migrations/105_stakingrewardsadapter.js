const { STAKING_REWARDS_ADAPTER_REGISTRY } = require('../test/utils/constants');
const json = require('./config/mintrs.json');

const Factory = artifacts.require('StakingRewardsAdapterFactory');
const Registry = artifacts.require('StakingRewardsAdapterRegistry');

module.exports = async function(deployer) {
  if (deployer.network === 'development') {
    return;
  }
  const factory = await Factory.deployed();
  const registry = await Registry.at(STAKING_REWARDS_ADAPTER_REGISTRY);
  const mintrs = json.mintrs;

  for(let i in mintrs) {
    const mintr = mintrs[i];
    // New adapter
    const tx = await factory.newAdapter(mintr.contract, mintr.stakingToken, mintr.rewardsToken);
    // Get adapter address from emitted event
    const adapter = tx.logs[0].args.adapter;
    // Register
    await registry.register(adapter, web3.utils.fromAscii(mintr.info));
    console.log(`deployed adapters[${i}]:`);
    console.log(`>>> adapter address = ${adapter}`);
    console.log(`>>> mintr   address = ${mintr.contract}`);
    console.log(`>>> info            = ${mintr.info}`);
  }
};
