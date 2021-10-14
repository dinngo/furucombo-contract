const { ethers } = require('hardhat');

const utils = ethers.utils;

module.exports = async hre => {
  const { deployments } = hre;
  const { deploy } = deployments;
  const { deployer } = await hre.getNamedAccounts();

  await deploy('HFurucomboRCOMBO', {
    from: deployer,
    args: [],
    log: true,
  });

  const registry = await hre.ethers.getContract('Registry', deployer);
  const hFurucomboRCOMBO = await hre.ethers.getContract(
    'HFurucomboRCOMBO',
    deployer
  );

  await registry.register(
    hFurucomboRCOMBO.address,
    utils.hexlify(utils.formatBytes32String('HFurucomboRCOMBO'))
  );
};

module.exports.tags = ['HFurucomboRCOMBO'];
module.exports.dependencies = ['Registry'];
