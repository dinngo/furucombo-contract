const hardhat = require('./addresses_hardhat');
const ethBeta = require('./addresses_eth_beta');
const eth = require('./addresses_eth');
const optimism = require('./addresses_optimism');
const arbitrum = require('./addresses_arbitrum');
const avalanche = require('./addresses_avalanche');
const polygon = require('./addresses_polygon');

module.exports =
  network.name == 'hardhat'
    ? hardhat
    : network.name == 'ethBeta'
    ? ethBeta
    : network.name == 'eth'
    ? eth
    : network.name == 'optimism'
    ? optimism
    : network.name == 'arbitrum'
    ? arbitrum
    : network.name == 'avalanche'
    ? avalanche
    : network.name == 'polygon'
    ? polygon
    : console.log('Unsupported network name') & process.exit(0);
module.exports.skip = async () => true;
