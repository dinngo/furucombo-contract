const Registry = artifacts.require('Registry');
const Handler = artifacts.require('HAaveProtocolV2');
const utils = web3.utils;
const AAVE_LENDINGPOOL_V2 = '0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9';

module.exports = async function(deployer) {
  if (deployer.network === 'development') {
    return;
  }
  await deployer.deploy(Handler);
  const registry = await Registry.deployed();
  await registry.register(Handler.address, utils.asciiToHex('HAaveProtocolV2'));
  await registry.registerCaller(AAVE_LENDINGPOOL_V2, Handler.address); // For flashloan callback use
};
