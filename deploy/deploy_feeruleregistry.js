const feeRate = '0.002'; // 0.2%
module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  console.log('deployer:' + deployer);

  if (network.name != 'hardhat') {
    // default is hardhat
    console.log('FeeRuleRegistry deployment script will be skipped.');
    return;
  }

  const basisFeeRate = ethers.utils.parseUnits(feeRate, 'ether'); // 0.2%
  const feeRuleRegistry = await deploy('FeeRuleRegistry', {
    from: deployer,
    args: [basisFeeRate, deployer],
    log: true,
  });
};

module.exports.tags = ['FeeRuleRegistry'];
