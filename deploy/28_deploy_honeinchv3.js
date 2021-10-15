const utils = ethers.utils;

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  await deploy('HOneInchV3', {
    from: deployer,
    args: [],
    log: true,
  });

  const registry = await hre.ethers.getContract('Registry', deployer);
  const hOneInchV3 = await hre.ethers.getContract('HOneInchV3', deployer);

  await registry.register(
    hOneInchV3.address,
    utils.formatBytes32String('HOneInchV3')
  );
};

module.exports.tags = ['HOneInchV3'];
module.exports.dependencies = ['Registry'];
