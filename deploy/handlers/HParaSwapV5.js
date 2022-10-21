const { deploy } = require('../utils/deploy.js');

module.exports = async () => {
  await deploy('HParaSwapV5');
};

module.exports.tags = ['HParaSwapV5'];
