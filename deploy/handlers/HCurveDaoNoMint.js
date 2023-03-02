const { deploy } = require('../utils/deploy.js');

module.exports = async () => {
  await deploy('HCurveDaoNoMint');
};

module.exports.tags = ['HCurveDaoNoMint'];
