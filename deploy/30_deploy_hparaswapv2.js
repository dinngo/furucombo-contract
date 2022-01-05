const utils = ethers.utils;

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  await deploy('HParaSwapV5', {
    from: deployer,
    args: [],
    log: true,
  });

  const registry = await ethers.getContract('Registry', deployer);
  const hParaSwapV5 = await ethers.getContract('HParaSwapV5', deployer);

  await registry.register(
    hParaSwapV5.address,
    utils.formatBytes32String('HParaSwapV5')
  );
};

module.exports.tags = ['HParaSwapV5'];
module.exports.dependencies = ['Registry'];
