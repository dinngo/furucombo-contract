const { deploy } = require('../utils/deploy.js');
const {
  WRAPPED_NATIVE_TOKEN,
  AAVEPROTOCOL_V3_PROVIDER,
} = require('../utils/addresses.js');

module.exports = async () => {
  await deploy(
    'HAaveProtocolV3',
    WRAPPED_NATIVE_TOKEN,
    AAVEPROTOCOL_V3_PROVIDER
  );
};

module.exports.tags = ['HAaveProtocolV3'];
