const { deploy } = require('../utils/deploy.js');
const {
  RADIAN_PROVIDER,
  WRAPPED_NATIVE_TOKEN,
} = require('../utils/addresses.js');

module.exports = async () => {
  await deploy('HRadiant', WRAPPED_NATIVE_TOKEN, RADIAN_PROVIDER);
};

module.exports.tags = ['HRadiant'];
