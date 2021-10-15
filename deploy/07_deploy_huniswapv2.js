const utils = ethers.utils;

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  await deploy('HUniswapV2', {
    from: deployer,
    args: [],
    log: true,
  });

  const registry = await hre.ethers.getContract('Registry', deployer);
  const hUniswapV2 = await hre.ethers.getContract('HUniswapV2', deployer);

  await registry.register(
    hUniswapV2.address,
    utils.formatBytes32String('HUniswapV2')
  );
};

module.exports.tags = ['HUniswapV2'];
module.exports.dependencies = ['Registry'];
