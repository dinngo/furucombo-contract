const { get, registerHandler } = require('../utils/deploy.js');

module.exports = async () => {
  const registry = await get('Registry');
  const handler = await get('HWrappedNativeToken');
  await registerHandler(registry, handler);
};

module.exports.tags = ['HWrappedNativeTokenPostSetup'];
module.exports.dependencies = ['Registry', 'HWrappedNativeToken'];
