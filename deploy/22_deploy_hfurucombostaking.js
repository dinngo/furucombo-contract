const { ethers } = require('hardhat');
const utils = ethers.utils;

module.exports = async hre => {
  const { deployments } = hre;
  const { deploy } = deployments;
  const { deployer } = await hre.getNamedAccounts();

  await deploy('HFurucomboStaking', {
    from: deployer,
    args: [],
    log: true,
  });

  const registry = await hre.ethers.getContract('Registry', deployer);
  const hFurucomboStaking = await hre.ethers.getContract(
    'HFurucomboStaking',
    deployer
  );

  await registry.register(
    hFurucomboStaking.address,
    utils.hexlify(utils.formatBytes32String('HFurucomboStaking'))
  );
};

module.exports.tags = ['HFurucomboStaking'];
module.exports.dependencies = ['Registry'];
