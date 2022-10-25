const { get, getAlias, registerRule } = require('../utils/deploy.js');

module.exports = async () => {
  const feeRuleRegistry = await get('FeeRuleRegistry');
  const rule = await getAlias('RStarNFTV4', 'RDiamondCube');
  await registerRule(feeRuleRegistry, rule);
};

module.exports.tags = ['RDiamondCubePostSetup'];
module.exports.dependencies = ['FeeRuleRegistry', 'RDiamondCube'];
