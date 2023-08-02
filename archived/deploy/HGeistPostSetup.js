const { get, registerHandler, registerCaller } = require('../utils/deploy.js');
const { GEIST_LENDING_POOL } = require('../utils/addresses.js');

module.exports = async () => {
  const registry = await get('Registry');
  const handler = await get('HGeist');
  await registerHandler(registry, handler);
  await registerCaller(registry, GEIST_LENDING_POOL, handler);
};

module.exports.tags = ['HGeistPostSetup'];
module.exports.dependencies = ['Registry', 'HGeist'];
