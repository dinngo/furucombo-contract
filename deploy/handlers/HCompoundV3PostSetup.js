const { get, registerHandler } = require('../utils/deploy.js');

module.exports = async () => {
  const registry = await get('Registry');
  const handler = await get('HCompoundV3');
  await registerHandler(registry, handler);
};

module.exports.tags = ['HCompoundV3PostSetup'];
module.exports.dependencies = ['Registry', 'HCompoundV3'];
