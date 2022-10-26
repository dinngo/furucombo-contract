const { get, getAlias, registerRule } = require('../utils/deploy.js');

module.exports = async () => {
  const feeRuleRegistry = await get('FeeRuleRegistry');
  const rule = await getAlias('RCubeNFT', 'RWoodenCube');
  await registerRule(feeRuleRegistry, rule);
};

module.exports.tags = ['RWoodenCubePostSetup'];
module.exports.dependencies = ['FeeRuleRegistry', 'RWoodenCube'];
