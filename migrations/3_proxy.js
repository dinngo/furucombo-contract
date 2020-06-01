const Proxy = artifacts.require('Proxy');
const Registry = artifacts.require('Registry');

module.exports = function(deployer) {
  deployer
    .then(function() {
      return Registry.deployed();
    })
    .then(function(instance) {
      registry = instance;
      return deployer.deploy(Proxy, registry.address);
    });
};
