const Registry = artifacts.require('Registry');
const Handler = artifacts.require('HGelatoV2LimitOrder');
const utils = web3.utils;

const {
  GELATOV2_PINE,
  GELATOV2_LIMIT_ORDER_MODULE,
} = require('../test/utils/constants');

module.exports = async function(deployer) {
  if (deployer.network === 'development') {
    return;
  }

  await deployer.deploy(Handler, GELATOV2_PINE, GELATOV2_LIMIT_ORDER_MODULE);
  const registry = await Registry.deployed();
  await registry.register(
    Handler.address,
    utils.asciiToHex('HGelatoV2LimitOrder')
  );
};
