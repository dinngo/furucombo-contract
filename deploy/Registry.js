const { deploy } = require('./utils/deploy.js');

module.exports = async () => {
  await deploy('Registry');
};

module.exports.tags = ['Registry'];
