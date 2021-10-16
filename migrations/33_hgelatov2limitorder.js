const Registry = artifacts.require('Registry');
const Handler = artifacts.require('HGelatoV2LimitOrder');
const utils = web3.utils;

const GELATOV2_PINE = '0x36049D479A97CdE1fC6E2a5D2caE30B666Ebf92B';
const GELATOV2_LIMIT_ORDER_MODULE =
  '0x037fc8e71445910e1E0bBb2a0896d5e9A7485318';
const GELATOV2_ERC20_ORDER_ROUTER =
  '0x5fb00386558ccc219e51b69d8e963ef20b0c267a';

module.exports = async function(deployer) {
  if (deployer.network === 'development') {
    return;
  }

  await deployer.deploy(
    Handler,
    GELATOV2_PINE,
    GELATOV2_LIMIT_ORDER_MODULE,
    GELATOV2_ERC20_ORDER_ROUTER
  );
  const registry = await Registry.deployed();
  await registry.register(
    Handler.address,
    utils.asciiToHex('HGelatoV2LimitOrder')
  );
};
