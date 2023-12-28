const { deploy } = require('../utils/deploy.js');
const { ONE_INCH_ROUTER } = require('../utils/addresses.js');

module.exports = async () => {
  await deploy('HOneInchV5', ONE_INCH_ROUTER);
};

module.exports.tags = ['HOneInchV5'];
