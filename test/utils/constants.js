const eth = require('./constants_eth');
const optimism = require('./constants_optimism');
const arbitrum = require('./constants_arbitrum');
const avalanche = require('./constants_avalanche');
const polygon = require('./constants_polygon');

module.exports =
  network.config.chainId == 1
    ? eth
    : network.config.chainId == 10
    ? optimism
    : network.config.chainId == 42161
    ? arbitrum
    : network.config.chainId == 43114
    ? avalanche
    : network.config.chainId == 137
    ? polygon
    : console.log('Unsupported CHAIN_ID') & process.exit(0);
