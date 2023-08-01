const { deploy } = require('../utils/deploy.js');
const {
  RADIANT_PROVIDER,
  WRAPPED_NATIVE_TOKEN,
} = require('../utils/addresses.js');

module.exports = async () => {
  await deploy('HRadiant', WRAPPED_NATIVE_TOKEN, RADIANT_PROVIDER);
};

module.exports.tags = ['HRadiant'];
