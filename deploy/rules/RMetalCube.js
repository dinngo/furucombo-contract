const { deployAlias } = require('../utils/deploy.js');
const { METAL_CUBE } = require('../utils/addresses.js');

const discount = ethers.utils.parseUnits('0.9', 'ether'); // 90%

module.exports = async () => {
  await deployAlias('RStarNFTV4', 'RMetalCube', METAL_CUBE, discount);
};

module.exports.tags = ['RMetalCube'];
