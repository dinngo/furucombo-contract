const Registry = artifacts.require('Registry');
// const Handler = artifacts.require('HERC20TokenIn');
const utils = web3.utils;

module.exports = function(deployer) {
  /** Deprecated
  deployer
    .deploy(Handler)
    .then(function() {
      return Registry.deployed();
    })
    .then(function(instance) {
      registry = instance;
      return registry.register(Handler.address, utils.asciiToHex('ERC20 In'));
    });
*/
};
