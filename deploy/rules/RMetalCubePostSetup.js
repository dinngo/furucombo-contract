const { get, getAlias, registerRule } = require('../utils/deploy.js');

module.exports = async () => {
  const feeRuleRegistry = await get('FeeRuleRegistry');
  const rule = await getAlias('RStarNFTV4', 'RMetalCube');
  await registerRule(feeRuleRegistry, rule);
};

module.exports.tags = ['RMetalCubePostSetup'];
module.exports.dependencies = ['FeeRuleRegistry', 'RMetalCube'];
