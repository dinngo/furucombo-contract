const { ethers } = require('hardhat');
const AAVE_LENDINGPOOL_V2 = '0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9';
const utils = ethers.utils;

module.exports = async hre => {
  const { deployments } = hre;
  const { deploy } = deployments;
  const { deployer } = await hre.getNamedAccounts();

  await deploy('HAaveProtocolV2', {
    from: deployer,
    args: [],
    log: true,
  });

  const registry = await hre.ethers.getContract('Registry', deployer);
  const hAaveProtocolV2 = await hre.ethers.getContract(
    'HAaveProtocolV2',
    deployer
  );

  await registry.register(
    hAaveProtocolV2.address,
    utils.formatBytes32String('HAaveProtocolV2')
  );

  await registry.registerCaller(
    AAVE_LENDINGPOOL_V2,
    utils.hexConcat([hAaveProtocolV2.address, '0x000000000000000000000000'])
  );
};

module.exports.tags = ['HAaveProtocolV2'];
module.exports.dependencies = ['Registry'];
