const { deployAlias } = require('../utils/deploy.js');
const { WOODEN_CUBE } = require('../utils/addresses.js');

const discount = ethers.utils.parseUnits('0.95', 'ether'); // 95%

module.exports = async () => {
  await deployAlias('RStarNFTV4', 'RWoodenCube', WOODEN_CUBE, discount);
};

module.exports.tags = ['RWoodenCube'];
