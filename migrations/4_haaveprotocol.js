const Registry = artifacts.require('Registry');
const Handler = artifacts.require('HAaveProtocol');
const utils = web3.utils;
const AAVE_LENDING_POOL_CORE = '0x398ec7346dcd622edc5ae82352f02be94c62d119';

module.exports = function(deployer) {
  if (deployer.network === 'development') {
    return;
  }
  deployer
    .deploy(Handler)
    .then(function() {
      return Registry.deployed();
    })
    .then(function(instance) {
      registry = instance;
      registry.registerCaller(AAVE_LENDING_POOL_CORE, Handler.address);
      return registry.register(
        Handler.address,
        utils.asciiToHex('Aave Protocol')
      );
    });
};
