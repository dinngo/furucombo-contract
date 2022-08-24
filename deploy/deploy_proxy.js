module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const registryAddr = (await ethers.getContract('Registry')).address;
  const feeRuleRegistryAddr = (await ethers.getContract('FeeRuleRegistry'))
    .address;
  await deploy('Proxy', {
    from: deployer,
    args: [registryAddr, feeRuleRegistryAddr],
    log: true,
  });
};

module.exports.tags = ['Proxy'];
module.exports.dependencies = ['Registry', 'FeeRuleRegistry'];
