const { deploy } = require('../utils/deploy.js');
const { WRAPPED_NATIVE_TOKEN } = require('../utils/addresses.js');

module.exports = async () => {
  await deploy('HCompoundV3', WRAPPED_NATIVE_TOKEN);
};

module.exports.tags = ['HCompoundV3'];
