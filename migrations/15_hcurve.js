const Registry = artifacts.require('Registry');
const Handler = artifacts.require('HCurve');
const utils = web3.utils;

module.exports = async function(deployer) {
  if (deployer.network === 'development') {
    return;
  }
  await deployer.deploy(Handler);
  //const registry = await Registry.deployed();
  const registry = await Registry.at(
    '0x1B742498dA0Aa60aE55e7a8673105635DBD7C64B'
  );
  await registry.register(Handler.address, utils.asciiToHex('HCurve'));
};
