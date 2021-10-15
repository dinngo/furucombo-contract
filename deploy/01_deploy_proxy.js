module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const registryAddr = (await hre.ethers.getContract('Registry')).address;
  await deploy('Proxy', {
    from: deployer,
    args: [registryAddr],
    log: true,
  });
};

module.exports.tags = ['Proxy'];
module.exports.dependencies = ['Registry'];
