const utils = ethers.utils;

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  await deploy('HStakingRewardsAdapter', {
    from: deployer,
    args: [],
    log: true,
  });

  const registry = await ethers.getContract('Registry', deployer);
  const hStakingRewardsAdapter = await ethers.getContract(
    'HStakingRewardsAdapter',
    deployer
  );

  await registry.register(
    hStakingRewardsAdapter.address,
    utils.formatBytes32String('HStakingRewardsAdapter')
  );
};

module.exports.tags = ['HStakingRewardsAdapter'];
module.exports.dependencies = ['Registry'];
