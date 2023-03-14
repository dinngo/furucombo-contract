const { get, registerHandler, registerCaller } = require('../utils/deploy.js');

module.exports = async () => {
  const registry = await get('Registry');
  const handler = await get('HLido');
  await registerHandler(registry, handler);
};

module.exports.tags = ['HLidoPostSetup'];
module.exports.dependencies = ['Registry', 'HLido'];
