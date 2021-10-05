const { ethers } = require("hardhat");
const utils = ethers.utils;

module.exports = async (hre) => {
  const { deployments } = hre;
  const { deploy } = deployments;
  const { deployer } = await hre.getNamedAccounts();

  await deploy('HCurve', {
    from: deployer,
    args: [],
    log: true,
  });

  const registry = await hre.ethers.getContract('Registry', deployer);
  const hCurve = await hre.ethers.getContract('HCurve', deployer);

  await registry.register(
    hCurve.address,
        utils.hexlify(utils.formatBytes32String('HCurve'))
      );
  
};


module.exports.tags = ['HCurve'];
module.exports.dependencies = ["Registry"];