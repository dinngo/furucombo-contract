const { ethers } = require("hardhat");
const utils = ethers.utils;

module.exports = async (hre) => {
  const { deployments } = hre;
  const { deploy } = deployments;
  const { deployer } = await hre.getNamedAccounts();

  await deploy('HPolygon', {
    from: deployer,
    args: [],
    log: true,
  });

  const registry = await hre.ethers.getContract('Registry', deployer);
  const hPolygon = await hre.ethers.getContract('HPolygon', deployer);

  await registry.register(
    hPolygon.address,
        utils.hexlify(utils.formatBytes32String('HPolygon'))
      );
};


module.exports.tags = ['HPolygon'];
module.exports.dependencies = ["Registry"];