const { ethers } = require('hardhat');
const utils = ethers.utils;

module.exports = async hre => {
  const { deployments } = hre;
  const { deploy } = deployments;
  const { deployer } = await hre.getNamedAccounts();

  await deploy('HWeth', {
    from: deployer,
    args: [],
    log: true,
  });

  const registry = await hre.ethers.getContract('Registry', deployer);
  const hWeth = await hre.ethers.getContract('HWeth', deployer);

  await registry.register(hWeth.address, utils.formatBytes32String('HWeth'));
};

module.exports.tags = ['HWeth'];
module.exports.dependencies = ['Registry'];
