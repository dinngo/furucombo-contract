const AAVE_LENDING_POOL_CORE = '0x398ec7346dcd622edc5ae82352f02be94c62d119';
const utils = ethers.utils;

module.exports = async ({ getNamedAccounts, deployments }) => {
  /* archived
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  await deploy('HAaveProtocol', {
    from: deployer,
    args: [],
    log: true,
  });

  const registry = await ethers.getContract('Registry', deployer);
  const hAaveProtocol = await ethers.getContract('HAaveProtocol');

  await registry.registerCaller(
    AAVE_LENDING_POOL_CORE,
    utils.hexConcat([hAaveProtocol.address, '0x000000000000000000000000'])
  );
  await registry.register(
    hAaveProtocol.address,
    utils.formatBytes32String('Aave Protocol')
  );
*/
};

module.exports.tags = ['HAaveProtocol'];
module.exports.dependencies = ['Registry'];
