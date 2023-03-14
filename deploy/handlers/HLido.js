const { deploy } = require('../utils/deploy.js');
const { LIDO_PROXY, LIDO_REFERRAL_CODE } = require('../utils/addresses.js');

module.exports = async () => {
  await deploy('HLido', LIDO_PROXY, LIDO_REFERRAL_CODE);
};

module.exports.tags = ['HLido'];
