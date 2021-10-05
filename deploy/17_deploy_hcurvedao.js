const { ethers } = require("hardhat");
const utils = ethers.utils;

module.exports = async (hre) => {
  const { deployments } = hre;
  const { deploy } = deployments;
  const { deployer } = await hre.getNamedAccounts();

  await deploy('HCurveDao', {
    from: deployer,
    args: [],
    log: true,
  });

  const registry = await hre.ethers.getContract('Registry', deployer);
  const hCurveDao = await hre.ethers.getContract('HCurveDao', deployer);

  await registry.register(
    hCurveDao.address,
        utils.hexlify(utils.formatBytes32String('HCurveDao'))
      );
  
};


module.exports.tags = ['HCurveDao'];
module.exports.dependencies = ["Registry"];