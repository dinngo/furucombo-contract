const {
  CREATE2_FACTORY,
  STAKING_REWARDS_ADAPTER_REGISTRY_SALT,
  STAKING_REWARDS_ADAPTER_REGISTRY,
} = require('../test/utils/constants');
const { getAdapterRegistryBytecodeBySolc } = require('../test/utils/getBytecode');
const ISingletonFactory = artifacts.require('ISingletonFactory');

module.exports = async function(deployer) {
  const singletonFactory = await ISingletonFactory.at(CREATE2_FACTORY);
  // Deploy AdapterRegistry
  const tx = await singletonFactory.deploy(
    getAdapterRegistryBytecodeBySolc(),
    STAKING_REWARDS_ADAPTER_REGISTRY_SALT
  );
  // Check if deplpyed contract address is same to the predicted one
  const log = tx.receipt.rawLogs[1];
  const registryAddr = log.address;
  if(registryAddr != STAKING_REWARDS_ADAPTER_REGISTRY) {
    console.error(`!!!!! Got different deployed AdapterRegistry with predicted one !!!!!`);
    console.error(`!!!!! Predicted: ${STAKING_REWARDS_ADAPTER_REGISTRY} !!!!!`);
    console.error(`!!!!! Deployed: ${registryAddr} !!!!!`);
  }
};

