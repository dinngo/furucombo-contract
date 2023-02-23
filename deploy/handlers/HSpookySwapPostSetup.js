const { get, registerHandler } = require('../utils/deploy.js');

module.exports = async () => {
  const registry = await get('Registry');
  const handler = await get('HSpookySwap');
  await registerHandler(registry, handler);
};

module.exports.tags = ['HSpookySwapPostSetup'];
module.exports.dependencies = ['Registry', 'HSpookySwap'];
