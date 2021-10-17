const utils = ethers.utils;

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  await deploy('HUniswapV3', {
    from: deployer,
    args: [],
    log: true,
  });

  const registry = await ethers.getContract('Registry', deployer);
  const hUniswapV3 = await ethers.getContract('HUniswapV3', deployer);

  await registry.register(
    hUniswapV3.address,
    utils.formatBytes32String('HUniswapV3')
  );
};

module.exports.tags = ['HUniswapV3'];
module.exports.dependencies = ['Registry'];
