
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

// module.exports.skip = async (hre) => {
//   console.log('network:' + hre.network.name);
//   const skip = hre.network.name === "mainnet" || hre.network.name === "hardhat"; // skip local deployment here for tests to run
//   return skip ? true : false;
// };

module.exports.tags = ['Proxy'];
module.exports.dependencies = ["Registry"];