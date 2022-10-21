const { deploy } = require('./utils/deploy.js');

const basisFeeRate = ethers.utils.parseUnits('0.002', 'ether'); // 0.2%

module.exports = async () => {
  const { deployer } = await getNamedAccounts();
  await deploy('FeeRuleRegistry', basisFeeRate, deployer);
};

module.exports.tags = ['FeeRuleRegistry'];
