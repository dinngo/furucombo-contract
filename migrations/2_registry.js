const Registry = artifacts.require('Registry');

module.exports = function(deployer) {
  if (deployer.network === 'development') {
    return;
  }
  deployer.deploy(Registry);
};
