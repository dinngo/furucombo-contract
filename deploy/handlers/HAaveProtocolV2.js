const { deploy } = require('../utils/deploy.js');
const {
  WRAPPED_NATIVE_TOKEN,
  AAVEPROTOCOL_V2_PROVIDER,
} = require('../utils/addresses.js');

module.exports = async () => {
  await deploy(
    'HAaveProtocolV2',
    WRAPPED_NATIVE_TOKEN,
    AAVEPROTOCOL_V2_PROVIDER
  );
};

module.exports.tags = ['HAaveProtocolV2'];
