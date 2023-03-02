const { get, registerHandler } = require('../utils/deploy.js');

module.exports = async () => {
  const registry = await get('Registry');
  const handler = await get('HGeist');
  await registerHandler(registry, handler);
};

module.exports.tags = ['HGeistPostSetup'];
module.exports.dependencies = ['Registry', 'HGeist'];
