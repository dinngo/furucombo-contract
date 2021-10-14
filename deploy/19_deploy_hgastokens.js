const { ethers } = require('hardhat');
const utils = ethers.utils;

module.exports = async hre => {
  const { deployments } = hre;
  const { deploy } = deployments;
  const { deployer } = await hre.getNamedAccounts();

  await deploy('HGasTokens', {
    from: deployer,
    args: [],
    log: true,
  });

  const registry = await hre.ethers.getContract('Registry', deployer);
  const hGasTokens = await hre.ethers.getContract('HGasTokens', deployer);

  await registry.register(
    hGasTokens.address,
    utils.hexlify(utils.formatBytes32String('HGasTokens'))
  );
};

module.exports.tags = ['HGasTokens'];
module.exports.dependencies = ['Registry'];
