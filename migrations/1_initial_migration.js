const Migrations = artifacts.require('Migrations');

module.exports = function(deployer) {
  if (deployer.network === 'development') {
    return;
  }
  deployer.deploy(Migrations);
};
