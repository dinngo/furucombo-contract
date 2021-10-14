const { ethers } = require('hardhat');
const utils = ethers.utils;

module.exports = async hre => {
  const { deployments } = hre;
  const { deploy } = deployments;
  const { deployer } = await hre.getNamedAccounts();

  await deploy('HYVault', {
    from: deployer,
    args: [],
    log: true,
  });

  const registry = await hre.ethers.getContract('Registry', deployer);
  const hYVault = await hre.ethers.getContract('HYVault', deployer);

  await registry.register(
    hYVault.address,
    utils.hexlify(utils.formatBytes32String('HYVault'))
  );
};

module.exports.tags = ['HYVault'];
module.exports.dependencies = ['Registry'];
