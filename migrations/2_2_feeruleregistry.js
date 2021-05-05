const FeeRuleRegistry = artifacts.require('FeeRuleRegistry');
const utils = web3.utils;
const FEE_COLLECTOR = '0xBcb909975715DC8fDe643EE44b89e3FD6A35A259';

module.exports = async function(deployer) {
  if (deployer.network === 'development') {
    return;
  }
  await deployer.deploy(FeeRuleRegistry, '0', FEE_COLLECTOR);
};
