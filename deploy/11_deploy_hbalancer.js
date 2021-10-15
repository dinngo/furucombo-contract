const utils = ethers.utils;

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  await deploy('HBalancer', {
    from: deployer,
    args: [],
    log: true,
  });

  const registry = await hre.ethers.getContract('Registry', deployer);
  const hBalancer = await hre.ethers.getContract('HBalancer', deployer);

  await registry.register(
    hBalancer.address,
    utils.formatBytes32String('HBalancer')
  );
};

module.exports.tags = ['HBalancer'];
module.exports.dependencies = ['Registry'];
