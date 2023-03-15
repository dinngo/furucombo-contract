const { deploy } = require('../utils/deploy.js');
const { LIDO_PROXY, LIDO_REFERRAL_ADDRESS } = require('../utils/addresses.js');

module.exports = async () => {
  await deploy('HLido', LIDO_PROXY, LIDO_REFERRAL_ADDRESS);
};

module.exports.tags = ['HLido'];
