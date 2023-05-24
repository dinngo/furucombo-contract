const { get, registerHandler } = require('../utils/deploy.js');

module.exports = async () => {
  const registry = await get('Registry');
  const handler = await get('HMaia');
  await registerHandler(registry, handler);
};

module.exports.tags = ['HMaiaPostSetup'];
module.exports.dependencies = ['Registry', 'HMaia'];
