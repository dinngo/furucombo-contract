const eth = require('./constants_eth');
const optimism = require('./constants_optimism');
const polygon = require('./constants_polygon');
const fantom = require('./constants_fantom');
const metis = require('./constants_metis');
const arbitrum = require('./constants_arbitrum');
const avalanche = require('./constants_avalanche');
const andromeda = require('./constants_andromeda');

module.exports =
  network.config.chainId == 1
    ? eth
    : network.config.chainId == 10
    ? optimism
    : network.config.chainId == 137
    ? polygon
    : network.config.chainId == 250
    ? fantom
    : network.config.chainId == 1088
    ? metis
    : network.config.chainId == 42161
    ? arbitrum
    : network.config.chainId == 43114
    ? avalanche
    : network.config.chainId == 1088
    ? andromeda
    : console.log('Unsupported CHAIN_ID') & process.exit(0);
