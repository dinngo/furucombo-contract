const Proxy = artifacts.require('Proxy');
const Registry = artifacts.require('Registry');
const Handler = artifacts.require('HBProtocol');
const DSProxyRegistry = artifacts.require('IDSProxyRegistry');
const utils = web3.utils;
const MAKER_PROXY_REGISTRY = '0x4678f0a6958e4d2bc4f1baf7bc52e8f3564f3fe4';

module.exports = async function(deployer) {
  if (deployer.network === 'development') {
    return;
  }
  await deployer.deploy(Handler);
  const dsRegistry = await DSProxyRegistry.at(MAKER_PROXY_REGISTRY);
  const registry = await Registry.deployed();
  const proxy = await Proxy.deployed();
  await registry.register(Handler.address, utils.asciiToHex('HBProtocol'));
  if(await dsRegistry.proxies.call(proxy.address) === "0x0000000000000000000000000000000000000000") await dsRegistry.build(proxy.address);
  console.log('dsproxy: ' + (await dsRegistry.proxies.call(proxy.address)));
};
