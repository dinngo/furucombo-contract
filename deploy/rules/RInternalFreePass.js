const { deployAlias } = require('../utils/deploy.js');
const { INTERNAL_FREE_PASS } = require('../utils/addresses.js');

const discount = ethers.utils.parseUnits('0', 'ether'); // 0%
const tokenId = 1;

module.exports = async () => {
  await deployAlias(
    'RERC1155NFT',
    'RInternalFreePass',
    INTERNAL_FREE_PASS,
    discount,
    tokenId
  );
};

module.exports.tags = ['RInternalFreePass'];
