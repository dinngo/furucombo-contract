const utils = ethers.utils;

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  await deploy('HCurveDao', {
    from: deployer,
    args: [],
    log: true,
  });

  const registry = await ethers.getContract('Registry', deployer);
  const hCurveDao = await ethers.getContract('HCurveDao', deployer);

  await registry.register(
    hCurveDao.address,
    utils.formatBytes32String('HCurveDao')
  );
};

module.exports.tags = ['HCurveDao'];
module.exports.dependencies = ['Registry'];
