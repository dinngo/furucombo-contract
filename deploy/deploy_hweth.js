const utils = ethers.utils;

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  await deploy('HWeth', {
    from: deployer,
    args: [],
    log: true,
  });

  const registry = await ethers.getContract('Registry', deployer);
  const hWeth = await ethers.getContract('HWeth', deployer);

  await registry.register(hWeth.address, utils.formatBytes32String('HWeth'));
};

module.exports.tags = ['HWeth'];
module.exports.dependencies = ['Registry'];
