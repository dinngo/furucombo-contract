const utils = ethers.utils;

module.exports = async ({ getNamedAccounts, deployments }) => {
  /* archived
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  await deploy('HKyberNetwork', {
    from: deployer,
    args: [],
    log: true,
  });

  const registry = await ethers.getContract('Registry', deployer);
  const hKyberNetwork = await ethers.getContract('HKyberNetwork', deployer);

  await registry.register(
    hKyberNetwork.address,
    utils.formatBytes32String('Kyber Network')
  );
*/
};

module.exports.tags = ['HKyberNetwork'];
module.exports.dependencies = ['Registry'];
