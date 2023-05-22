const { deploy } = require('../utils/deploy.js');
const { HUMMUS_ROUTER01 } = require('../utils/addresses.js');

module.exports = async () => {
  await deploy('HHummus', HUMMUS_ROUTER01);
};

module.exports.tags = ['HHummus'];
