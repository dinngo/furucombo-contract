
module.exports = async ({getNamedAccounts, deployments}) => {
  console.log('-----Start Registry');
  const {deploy} = deployments;
  const {deployer} = await getNamedAccounts();
  console.log(deployer);
  await deploy('Registry', {
    from: deployer,
    args: [],
    log: true,
  });

  console.log('-----Succ');
};

// module.exports.skip = async (hre) => {
//   console.log('network:' + hre.network.name);
//   const skip = hre.network.name === "mainnet" || hre.network.name === "hardhat"; // skip local deployment here for tests to run
//   return skip ? true : false;
// };

module.exports.tags = ['Registry'];