const { ethers } = require("hardhat");

const utils = ethers.utils;

module.exports = async (hre) => {
  const { deployments } = hre;
  const { deploy } = deployments;
  const { deployer } = await hre.getNamedAccounts();

  await deploy('HOneInchExchange', {
    from: deployer,
    args: [],
    log: true,
  });

  const registry = await hre.ethers.getContract('Registry', deployer);
  const hOneInchExchange = await hre.ethers.getContract('HOneInchExchange', deployer);

  await registry.register(
    hOneInchExchange.address,
        utils.hexlify(utils.formatBytes32String('HOneInchExchange'))
      );
};


module.exports.tags = ['HOneInchExchange'];
module.exports.dependencies = ["Registry"];