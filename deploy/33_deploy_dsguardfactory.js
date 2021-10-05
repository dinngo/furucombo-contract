const { ethers } = require("hardhat");
const utils = ethers.utils;

module.exports = async (hre) => {
  const { deployments } = hre;
  const { deploy } = deployments;
  const { deployer } = await hre.getNamedAccounts();

  await deploy('DSGuardFactory', {
    from: deployer,
    args: [],
    log: true,
  });
};

module.exports.tags = ['DSGuardFactory'];