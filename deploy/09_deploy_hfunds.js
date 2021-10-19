const utils = ethers.utils;

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  await deploy('HFunds', {
    from: deployer,
    args: [],
    log: true,
  });

  const registry = await ethers.getContract('Registry', deployer);
  const hFunds = await ethers.getContract('HFunds', deployer);

  await registry.register(hFunds.address, utils.formatBytes32String('HFunds'));
};

module.exports.tags = ['HFunds'];
module.exports.dependencies = ['Registry'];
