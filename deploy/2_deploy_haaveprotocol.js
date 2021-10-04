const { ethers } = require("hardhat");

const AAVE_LENDING_POOL_CORE = '0x398ec7346dcd622edc5ae82352f02be94c62d119';
const utils = ethers.utils;

module.exports = async (hre) => {
  const { deployments } = hre;
  const { deploy } = deployments;
  const { deployer } = await hre.getNamedAccounts();

  await deploy('HAaveProtocol', {
    from: deployer,
    args: [],
    log: true,
  });

  const registry = await hre.ethers.getContract('Registry', deployer);
  const hAaveProtocol = await hre.ethers.getContract('HAaveProtocol');

  console.log('----');
  // console.log(registry);
  console.log(utils.hexZeroPad(hAaveProtocol.address, 32));
  console.log(utils.zeroPad(hAaveProtocol.address, 32));
  console.log(utils.hexConcat([hAaveProtocol.address, '0x000000000000000000000000']));
  
  await registry.registerCaller(AAVE_LENDING_POOL_CORE, 
                                utils.hexConcat([hAaveProtocol.address, '0x000000000000000000000000'])
                                );
  await registry.register(
    hAaveProtocol.address,
        utils.hexlify(utils.formatBytes32String('Aave Protocol'))
      );
  
};


module.exports.tags = ['Proxy'];
module.exports.dependencies = ["Registry"];