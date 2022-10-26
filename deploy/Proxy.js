const { get, deploy } = require('./utils/deploy.js');

module.exports = async () => {
  const registryAddr = (await get('Registry')).address;
  const feeRuleRegistryAddr = (await get('FeeRuleRegistry')).address;
  await deploy('Proxy', registryAddr, feeRuleRegistryAddr);
};

module.exports.tags = ['Proxy'];
module.exports.dependencies = ['Registry', 'FeeRuleRegistry'];
