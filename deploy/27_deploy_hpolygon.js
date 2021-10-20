const utils = ethers.utils;

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  await deploy('HPolygon', {
    from: deployer,
    args: [],
    log: true,
  });

  const registry = await ethers.getContract('Registry', deployer);
  const hPolygon = await ethers.getContract('HPolygon', deployer);

  await registry.register(
    hPolygon.address,
    utils.formatBytes32String('HPolygon')
  );
};

module.exports.tags = ['HPolygon'];
module.exports.dependencies = ['Registry'];
