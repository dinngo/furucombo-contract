const { ethers } = require('hardhat');
const utils = ethers.utils;

module.exports = async hre => {
  const { deployments } = hre;
  const { deploy } = deployments;
  const { deployer } = await hre.getNamedAccounts();

  await deploy('HFunds', {
    from: deployer,
    args: [],
    log: true,
  });

  const registry = await hre.ethers.getContract('Registry', deployer);
  const hFunds = await hre.ethers.getContract('HFunds', deployer);

  await registry.register(
    hFunds.address,
    utils.hexlify(utils.formatBytes32String('HFunds'))
  );
};

module.exports.tags = ['HFunds'];
module.exports.dependencies = ['Registry'];
