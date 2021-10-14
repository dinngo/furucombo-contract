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

// module.exports.skip = async (hre) => {
//   console.log('network:' + hre.network.name);
//   const skip = hre.network.name === "mainnet" || hre.network.name === "hardhat"; // skip local deployment here for tests to run
//   return skip ? true : false;
// };

module.exports.tags = ['Registry'];
