const utils = ethers.utils;

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  await deploy('HFurucomboRCOMBO', {
    from: deployer,
    args: [],
    log: true,
  });

  const registry = await hre.ethers.getContract('Registry', deployer);
  const hFurucomboRCOMBO = await hre.ethers.getContract(
    'HFurucomboRCOMBO',
    deployer
  );

  await registry.register(
    hFurucomboRCOMBO.address,
    utils.formatBytes32String('HFurucomboRCOMBO')
  );
};

module.exports.tags = ['HFurucomboRCOMBO'];
module.exports.dependencies = ['Registry'];
