const { deploy } = require('../utils/deploy.js');

module.exports = async () => {
  await deploy('HMath');
};

module.exports.tags = ['HMath'];
