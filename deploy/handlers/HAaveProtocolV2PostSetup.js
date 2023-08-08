const { get, registerHandler, registerCaller } = require('../utils/deploy.js');
const { AAVE_POOL_V2 } = require('../utils/addresses.js');

module.exports = async () => {
  const registry = await get('Registry');
  const handler = await get('HAaveProtocolV2');
  await registerHandler(registry, handler);
  await registerCaller(registry, AAVE_POOL_V2, handler);
};

module.exports.tags = ['HAaveProtocolV2PostSetup'];
module.exports.dependencies = ['Registry', 'HAaveProtocolV2'];
