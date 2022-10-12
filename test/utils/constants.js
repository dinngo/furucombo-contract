const eth = require('./constants-eth');
const optimism = require('./constants-optimism');
const arbitrum = require('./constants-arbitrum');
const avalanche = require('./constants-avalanche');

module.exports =
  network.config.chainId == 1
    ? eth
    : network.config.chainId == 10
    ? optimism
    : network.config.chainId == 42161
    ? arbitrum
    : network.config.chainId == 43114
    ? avalanche
    : console.log('Unsupported CHAIN_ID') & process.exit(0);
