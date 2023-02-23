const hardhat = require('./addresses_hardhat');
const ethBeta = require('./addresses_eth_beta');
const eth = require('./addresses_eth');
const optimism = require('./addresses_optimism');
const polygon = require('./addresses_polygon');
const fantom = require('./addresses_fantom');
const arbitrum = require('./addresses_arbitrum');
const avalanche = require('./addresses_avalanche');

module.exports =
  network.name == 'hardhat'
    ? hardhat
    : network.name == 'ethBeta'
    ? ethBeta
    : network.name == 'eth'
    ? eth
    : network.name == 'optimism'
    ? optimism
    : network.name == 'polygon'
    ? polygon
    : network.name == 'fantom'
    ? fantom
    : network.name == 'arbitrum'
    ? arbitrum
    : network.name == 'avalanche'
    ? avalanche
    : console.log('Unsupported network name') & process.exit(0);
module.exports.skip = async () => true;
