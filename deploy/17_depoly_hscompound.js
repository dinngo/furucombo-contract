const utils = ethers.utils;

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  await deploy('HSCompound', {
    from: deployer,
    args: [],
    log: true,
  });

  const registry = await hre.ethers.getContract('Registry', deployer);
  const hSCompound = await hre.ethers.getContract('HSCompound', deployer);

  await registry.register(
    hSCompound.address,
    utils.formatBytes32String('HSCompound')
  );
};

module.exports.tags = ['HSCompound'];
module.exports.dependencies = ['Registry'];
