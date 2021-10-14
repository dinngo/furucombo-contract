const { ethers } = require('hardhat');
const utils = ethers.utils;

module.exports = async hre => {
  const { deployments } = hre;
  const { deploy } = deployments;
  const { deployer } = await hre.getNamedAccounts();

  await deploy('HCToken', {
    from: deployer,
    args: [],
    log: true,
  });

  const registry = await hre.ethers.getContract('Registry', deployer);
  const hCToken = await hre.ethers.getContract('HCToken', deployer);

  await registry.register(
    hCToken.address,
    utils.hexlify(utils.formatBytes32String('Compound Token'))
  );
};

module.exports.tags = ['HCEther'];
module.exports.dependencies = ['Registry'];
