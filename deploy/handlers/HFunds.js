const { deploy } = require('../utils/deploy.js');

module.exports = async () => {
  await deploy('HFunds');
};

module.exports.tags = ['HFunds'];
