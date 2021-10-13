const { ethers } = require("hardhat");
const utils = ethers.utils;

module.exports = async (hre) => {
  const { deployments } = hre;
  const { deploy } = deployments;
  const { deployer } = await hre.getNamedAccounts();

  await deploy('HKyberNetwork', {
    from: deployer,
    args: [],
    log: true,
  });

  const registry = await hre.ethers.getContract('Registry', deployer);
  const hKyberNetwork = await hre.ethers.getContract('HKyberNetwork', deployer);

  await registry.register(
    hKyberNetwork.address,
        utils.hexlify(utils.formatBytes32String('Kyber Network'))
      );
};


module.exports.tags = ['HKyberNetwork'];
module.exports.dependencies = ["Registry"];