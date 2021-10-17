const utils = ethers.utils;

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  await deploy('HComptroller', {
    from: deployer,
    args: [],
    log: true,
  });

  const registry = await ethers.getContract('Registry', deployer);
  const hComptroller = await ethers.getContract('HComptroller', deployer);

  await registry.register(
    hComptroller.address,
    utils.formatBytes32String('HComptroller')
  );
};

module.exports.tags = ['HComptroller'];
module.exports.dependencies = ['Registry'];
