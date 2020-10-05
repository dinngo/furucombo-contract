const Registry = artifacts.require('Registry');
const Handler = artifacts.require('HBalancerExchange');
const utils = web3.utils;

module.exports = async function(deployer) {
  await deployer.deploy(Handler);
  const registry = await Registry.deployed();
  await registry.register(
    Handler.address,
    utils.asciiToHex('HBalancerExchange')
  );
};
