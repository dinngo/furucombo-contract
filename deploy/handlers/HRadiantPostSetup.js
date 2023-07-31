const { get, registerHandler, registerCaller } = require('../utils/deploy.js');
const { RADIANT_POOL } = require('../utils/addresses.js');

module.exports = async () => {
  const registry = await get('Registry');
  const handler = await get('HRadiant');
  await registerHandler(registry, handler);
  await registerCaller(registry, RADIANT_POOL, handler);
};

module.exports.tags = ['HRadiantPostSetup'];
module.exports.dependencies = ['Registry', 'HRadiant'];
