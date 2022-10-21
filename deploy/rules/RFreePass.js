const { deployAlias } = require('../utils/deploy.js');
const { FREE_PASS } = require('../utils/addresses.js');

const discount = ethers.utils.parseUnits('0', 'ether'); // 0%

module.exports = async () => {
  await deployAlias('RCubeNFT', 'RFreePass', FREE_PASS, discount);
};

module.exports.tags = ['RFreePass'];
