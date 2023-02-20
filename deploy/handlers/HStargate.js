const { deploy } = require('../utils/deploy.js');
const {
  STARGATE_PARTNER_ID,
  STARGATE_ROUTER,
  STARGATE_ROUTER_ETH,
  STARGATE_FACTORY,
  STARGATE_WIDGET_SWAP,
} = require('../utils/addresses.js');

module.exports = async () => {
  await deploy(
    'HStargate',
    STARGATE_ROUTER,
    STARGATE_ROUTER_ETH,
    STARGATE_FACTORY,
    STARGATE_WIDGET_SWAP,
    STARGATE_PARTNER_ID
  );
};

module.exports.tags = ['HStargate'];
