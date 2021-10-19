module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  console.log('deployer:' + deployer);
  await deploy('Registry', {
    from: deployer,
    args: [],
    log: true,
  });
};

module.exports.tags = ['Registry'];
