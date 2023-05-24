const { deploy } = require('../utils/deploy.js');

module.exports = async () => {
  await deploy('HMaia');
};

module.exports.tags = ['HMaia'];
