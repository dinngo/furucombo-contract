const { get, registerHandler } = require('../utils/deploy.js');

module.exports = async () => {
  const registry = await get('Registry');
  const handler = await get('HParaSwapV5');
  await registerHandler(registry, handler);
};

module.exports.tags = ['HParaSwapV5PostSetup'];
module.exports.dependencies = ['Registry', 'HParaSwapV5'];
