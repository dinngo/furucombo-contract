const Factory = artifacts.require('StakingRewardsAdapterFactory');

module.exports = async function(deployer) {
  await deployer.deploy(Factory);
};
