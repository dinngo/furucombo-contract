const { get, registerHandler } = require('../utils/deploy.js');

module.exports = async () => {
  const registry = await get('Registry');
  const handler = await get('HUniswapV3');
  await registerHandler(registry, handler);
};

module.exports.tags = ['HUniswapV3PostSetup'];
module.exports.dependencies = ['Registry', 'HUniswapV3'];
