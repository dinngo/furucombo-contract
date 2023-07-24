const { get, registerHandler } = require('../utils/deploy.js');

module.exports = async () => {
  const registry = await get('Registry');
  const handler = await get('HMath');
  await registerHandler(registry, handler);
};

module.exports.tags = ['HMathPostSetup'];
module.exports.dependencies = ['Registry', 'HMath'];
