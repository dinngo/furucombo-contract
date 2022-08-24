const utils = ethers.utils;

module.exports = async ({ getNamedAccounts, deployments }) => {
  /*
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  await deploy('HBalancerExchange', {
    from: deployer,
    args: [],
    log: true,
  });

  const registry = await ethers.getContract('Registry', deployer);
  const hBalancerExchange = await ethers.getContract(
    'HBalancerExchange',
    deployer
  );

  await registry.register(
    hBalancerExchange.address,
    utils.formatBytes32String('HBalancerExchange')
  );
*/
};

module.exports.tags = ['HBalancerExchange'];
module.exports.dependencies = ['Registry'];
