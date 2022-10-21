module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  console.log('deployer:' + deployer);

  if (network.name != 'hardhat') {
    // default is hardhat
    console.log('Registry deployment script will be skipped.');
    return;
  }

  await deploy('Registry', {
    from: deployer,
    args: [],
    log: true,
  });
};

module.exports.tags = ['Registry'];
