const { deploy } = require('../utils/deploy.js');

module.exports = async () => {
  await deploy('HSpookySwap');
};

module.exports.tags = ['HSpookySwap'];
