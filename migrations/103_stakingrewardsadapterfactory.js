const Factory = artifacts.require('StakingRewardsAdapterFactory');

module.exports = async function(deployer) {
  if (deployer.network === 'development') {
    return;
  }
  await deployer.deploy(Factory);
};
