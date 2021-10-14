const { ethers } = require('hardhat');

const utils = ethers.utils;

module.exports = async hre => {
  const { deployments } = hre;
  const { deploy } = deployments;
  const { deployer } = await hre.getNamedAccounts();

  await deploy('HSushiSwap', {
    from: deployer,
    args: [],
    log: true,
  });

  const registry = await hre.ethers.getContract('Registry', deployer);
  const hSushiSwap = await hre.ethers.getContract('HSushiSwap', deployer);

  await registry.register(
    hSushiSwap.address,
    utils.hexlify(utils.formatBytes32String('HSushiSwap'))
  );
};

module.exports.tags = ['HSushiSwap'];
module.exports.dependencies = ['Registry'];
