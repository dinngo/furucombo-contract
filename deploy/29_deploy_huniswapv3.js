const { ethers } = require('hardhat');

const utils = ethers.utils;

module.exports = async hre => {
  const { deployments } = hre;
  const { deploy } = deployments;
  const { deployer } = await hre.getNamedAccounts();

  await deploy('HUniswapV3', {
    from: deployer,
    args: [],
    log: true,
  });

  const registry = await hre.ethers.getContract('Registry', deployer);
  const hUniswapV3 = await hre.ethers.getContract('HUniswapV3', deployer);

  await registry.register(
    hUniswapV3.address,
    utils.hexlify(utils.formatBytes32String('HUniswapV3'))
  );
};

module.exports.tags = ['HUniswapV3'];
module.exports.dependencies = ['Registry'];
