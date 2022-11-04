const { deployAlias } = require('../utils/deploy.js');
const { DIAMOND_CUBE } = require('../utils/addresses.js');

const discount = ethers.utils.parseUnits('0.8', 'ether'); // 80%

module.exports = async () => {
  await deployAlias('RStarNFTV4', 'RDiamondCube', DIAMOND_CUBE, discount);
};

module.exports.tags = ['RDiamondCube'];
