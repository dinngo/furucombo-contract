const utils = ethers.utils;

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  await deploy('HCEther', {
    from: deployer,
    args: [],
    log: true,
  });

  const registry = await ethers.getContract('Registry', deployer);
  const hCEther = await ethers.getContract('HCEther', deployer);

  await registry.register(
    hCEther.address,
    utils.formatBytes32String('Compound Ether')
  );
};

module.exports.tags = ['HCEther'];
module.exports.dependencies = ['Registry'];
