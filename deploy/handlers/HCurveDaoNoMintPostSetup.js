const { get, registerHandler } = require('../utils/deploy.js');

module.exports = async () => {
  const registry = await get('Registry');
  const handler = await get('HCurveDaoNoMint');
  await registerHandler(registry, handler);
};

module.exports.tags = ['HCurveDaoNoMintPostSetup'];
module.exports.dependencies = ['Registry', 'HCurveDaoNoMint'];
