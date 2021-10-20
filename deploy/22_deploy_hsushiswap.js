const utils = ethers.utils;

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  await deploy('HSushiSwap', {
    from: deployer,
    args: [],
    log: true,
  });

  const registry = await ethers.getContract('Registry', deployer);
  const hSushiSwap = await ethers.getContract('HSushiSwap', deployer);

  await registry.register(
    hSushiSwap.address,
    utils.formatBytes32String('HSushiSwap')
  );
};

module.exports.tags = ['HSushiSwap'];
module.exports.dependencies = ['Registry'];
