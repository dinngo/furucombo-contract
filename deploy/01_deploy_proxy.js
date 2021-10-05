
module.exports = async (hre) => {
  const { deployments } = hre;
  const { deploy } = deployments;
  const { deployer } = await hre.getNamedAccounts();

  const registryAddr = (await hre.ethers.getContract('Registry')).address;
  await deploy('Proxy', {
    from: deployer,
    args: [registryAddr],
    log: true,
  });
};


module.exports.tags = ['Proxy'];
module.exports.dependencies = ["Registry"];