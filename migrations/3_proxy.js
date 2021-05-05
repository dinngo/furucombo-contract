const Proxy = artifacts.require('Proxy');
const Registry = artifacts.require('Registry');
const FeeRuleRegistry = artifacts.require('FeeRuleRegistry');

module.exports = async function(deployer) {
  if (deployer.network === 'development') {
    return;
  }
  const registry = await Registry.deployed();
  const feeRuleRegistry = await FeeRuleRegistry.deployed();
  await deployer.deploy(Proxy, registry.address, feeRuleRegistry.address);
};
