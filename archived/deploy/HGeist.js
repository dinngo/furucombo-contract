const { deploy } = require('../utils/deploy.js');
const {
  WRAPPED_NATIVE_TOKEN,
  GEIST_LENDING_POOL_PROVIDER,
} = require('../utils/addresses.js');

const GEIST_REFERRAL_CODE = 0; // Not apply yet

module.exports = async () => {
  await deploy(
    'HGeist',
    WRAPPED_NATIVE_TOKEN,
    GEIST_LENDING_POOL_PROVIDER,
    GEIST_REFERRAL_CODE
  );
};

module.exports.tags = ['HGeist'];
