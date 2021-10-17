const utils = ethers.utils;

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  await deploy('HGasTokens', {
    from: deployer,
    args: [],
    log: true,
  });

  const registry = await ethers.getContract('Registry', deployer);
  const hGasTokens = await ethers.getContract('HGasTokens', deployer);

  await registry.register(
    hGasTokens.address,
    utils.formatBytes32String('HGasTokens')
  );
};

module.exports.tags = ['HGasTokens'];
module.exports.dependencies = ['Registry'];
