const eth = require('./constants_eth');
const optimism = require('./constants_optimism');
const polygon = require('./constants_polygon');
const arbitrum = require('./constants_arbitrum');
const avalanche = require('./constants_avalanche');

module.exports =
  network.config.chainId == 1
    ? eth
    : network.config.chainId == 10
    ? optimism
    : network.config.chainId == 137
    ? polygon
    : network.config.chainId == 42161
    ? arbitrum
    : network.config.chainId == 43114
    ? avalanche
    : console.log('Unsupported CHAIN_ID') & process.exit(0);
