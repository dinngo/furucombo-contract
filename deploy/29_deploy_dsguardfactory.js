const utils = ethers.utils;

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  await deploy('DSGuardFactory', {
    from: deployer,
    args: [],
    log: true,
  });
};

module.exports.tags = ['DSGuardFactory'];
