const { constants } = require('@openzeppelin/test-helpers');
const {
  CREATE2_FACTORY,
  STAKING_REWARDS_ADAPTER_REGISTRY_SALT,
  STAKING_REWARDS_ADAPTER_REGISTRY,
} = require('../test/utils/constants');
const { getAdapterRegistryBytecodeBySolc } = require('../test/utils/getBytecode');
const ISingletonFactory = artifacts.require('ISingletonFactory');

module.exports = async function(deployer) {
  if (deployer.network === 'development') {
    return;
  }
  const singletonFactory = await ISingletonFactory.at(CREATE2_FACTORY);
  // Check if deployed contract address is same to the predicted one
  const deployAddr = await singletonFactory.deploy.call(
    getAdapterRegistryBytecodeBySolc(),
    STAKING_REWARDS_ADAPTER_REGISTRY_SALT
  );
  
  // Exit if we get zero address
  if (deployAddr == constants.ZERO_ADDRESS) {
    console.log(`Got zero address when attempting to deploy AdapterRegistry`);
    return false;
  }

  if (deployAddr != STAKING_REWARDS_ADAPTER_REGISTRY) {
    console.error(
      `!!!!! Got different AdapterRegistry address with predicted one !!!!!`
    );
    console.error(`!!!!! Predicted: ${STAKING_REWARDS_ADAPTER_REGISTRY} !!!!!`);
    console.error(`!!!!! Going To Deploy At: ${deployAddr} !!!!!`);
    console.error(`!!!!! Deploy process rejected !!!!!`);
    return false;
  }
  // Deploy AdapterRegistry
  await singletonFactory.deploy(
    getAdapterRegistryBytecodeBySolc(),
    STAKING_REWARDS_ADAPTER_REGISTRY_SALT
  );
  console.log(`Deployed AdapterRegistry: ${deployAddr}`);
};

