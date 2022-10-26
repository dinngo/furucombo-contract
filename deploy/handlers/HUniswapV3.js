const { deploy } = require('../utils/deploy.js');
const { WRAPPED_NATIVE_TOKEN } = require('../utils/addresses.js');

module.exports = async () => {
  await deploy('HUniswapV3', WRAPPED_NATIVE_TOKEN);
};

module.exports.tags = ['HUniswapV3'];
