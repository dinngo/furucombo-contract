const { get, getAlias, registerRule } = require('../utils/deploy.js');

module.exports = async () => {
  const feeRuleRegistry = await get('FeeRuleRegistry');
  const rule = await getAlias('RCubeNFT', 'RFreePass');
  await registerRule(feeRuleRegistry, rule);
};

module.exports.tags = ['RFreePassPostSetup'];
module.exports.dependencies = ['FeeRuleRegistry', 'RFreePass'];
