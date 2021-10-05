const { ethers } = require("hardhat");
const utils = ethers.utils;

module.exports = async (hre) => {
  const { deployments } = hre;
  const { deploy } = deployments;
  const { deployer } = await hre.getNamedAccounts();

  await deploy('HCEther', {
    from: deployer,
    args: [],
    log: true,
  });

  const registry = await hre.ethers.getContract('Registry', deployer);
  const hCEther = await hre.ethers.getContract('HCEther', deployer);

  await registry.register(
    hCEther.address,
        utils.hexlify(utils.formatBytes32String('Compound Ether'))
      );
  
};


module.exports.tags = ['HCEther'];
module.exports.dependencies = ["Registry"];