const Factory = artifacts.require('DSGuardFactory');

module.exports = async function(deployer) {
  await deployer.deploy(Factory);
};
