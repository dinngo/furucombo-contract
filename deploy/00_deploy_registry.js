module.exports = async hre => {
  const { deployments } = hre;
  const { deploy } = deployments;
  const { deployer } = await hre.getNamedAccounts();
  console.log('deployer:' + deployer);
  await deploy('Registry', {
    from: deployer,
    args: [],
    log: true,
  });
};

module.exports.tags = ['Registry'];
