const utils = ethers.utils;

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  await deploy('HCurve', {
    from: deployer,
    args: [],
    log: true,
  });

  const registry = await ethers.getContract('Registry', deployer);
  const hCurve = await ethers.getContract('HCurve', deployer);

  await registry.register(hCurve.address, utils.formatBytes32String('HCurve'));
};

module.exports.tags = ['HCurve'];
module.exports.dependencies = ['Registry'];
