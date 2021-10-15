const utils = ethers.utils;

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  await deploy('HOneInchExchange', {
    from: deployer,
    args: [],
    log: true,
  });

  const registry = await hre.ethers.getContract('Registry', deployer);
  const hOneInchExchange = await hre.ethers.getContract(
    'HOneInchExchange',
    deployer
  );

  await registry.register(
    hOneInchExchange.address,
    utils.formatBytes32String('HOneInchExchange')
  );
};

module.exports.tags = ['HOneInchExchange'];
module.exports.dependencies = ['Registry'];
