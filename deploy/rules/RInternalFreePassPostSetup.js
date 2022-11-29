const { get, getAlias, registerRule } = require('../utils/deploy.js');

module.exports = async () => {
  const feeRuleRegistry = await get('FeeRuleRegistry');
  const rule = await getAlias('RERC1155NFT', 'RInternalFreePass');
  await registerRule(feeRuleRegistry, rule);
};

module.exports.tags = ['RInternalFreePassPostSetup'];
module.exports.dependencies = ['FeeRuleRegistry', 'RInternalFreePass'];
