const { get, registerHandler } = require('../utils/deploy.js');

module.exports = async () => {
  const registry = await get('Registry');
  const handler = await get('HOneInchV5');
  await registerHandler(registry, handler);
};

module.exports.tags = ['HOneInchV5PostSetup'];
module.exports.dependencies = ['Registry', 'HOneInchV5'];
