const { get, registerHandler } = require('../utils/deploy.js');

module.exports = async () => {
  const registry = await get('Registry');
  const handler = await get('HStargate');
  await registerHandler(registry, handler);
};

module.exports.tags = ['HStargatePostSetup'];
module.exports.dependencies = ['Registry', 'HStargate'];
