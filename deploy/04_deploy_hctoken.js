const utils = ethers.utils;

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  await deploy('HCToken', {
    from: deployer,
    args: [],
    log: true,
  });

  const registry = await ethers.getContract('Registry', deployer);
  const hCToken = await ethers.getContract('HCToken', deployer);

  await registry.register(
    hCToken.address,
    utils.formatBytes32String('Compound Token')
  );
};

module.exports.tags = ['HCToken'];
module.exports.dependencies = ['Registry'];
