const Proxy = artifacts.require('Proxy');
const Registry = artifacts.require('Registry');

module.exports = function(deployer) {
  if (deployer.network === 'development') {
    return;
  }
  deployer
    .then(function() {
      return Registry.deployed();
    })
    .then(function(instance) {
      registry = instance;
      return deployer.deploy(Proxy, registry.address);
    });
};
