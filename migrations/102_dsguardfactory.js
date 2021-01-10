const Factory = artifacts.require('DSGuardFactory');

module.exports = async function(deployer) {
  if (deployer.network === 'development') {
    return;
  }
  await deployer.deploy(Factory);
};
