const utils = ethers.utils;

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  await deploy('HWrappedNativeToken', {
    from: deployer,
    args: [],
    log: true,
  });

  const registry = await ethers.getContract('Registry', deployer);
  const hWeth = await ethers.getContract('HWrappedNativeToken', deployer);

  await registry.register(
    hWeth.address,
    utils.formatBytes32String('HWrappedNativeToken')
  );
};

module.exports.tags = ['HWrappedNativeToken'];
module.exports.dependencies = ['Registry'];
