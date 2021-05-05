const Registry = artifacts.require('Registry');

module.exports = async function(deployer) {
  if (deployer.network === 'development') {
    return;
  }
  await deployer.deploy(Registry);
};
