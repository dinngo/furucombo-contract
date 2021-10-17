const utils = ethers.utils;
const GELATOV2_PINE = '0x36049D479A97CdE1fC6E2a5D2caE30B666Ebf92B';
const GELATOV2_LIMIT_ORDER_MODULE =
  '0x037fc8e71445910e1E0bBb2a0896d5e9A7485318';

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  await deploy('HGelatoV2LimitOrder', {
    from: deployer,
    args: [GELATOV2_PINE, GELATOV2_LIMIT_ORDER_MODULE],
    log: true,
  });

  const registry = await ethers.getContract('Registry', deployer);
  const hGelatoV2LimitOrder = await ethers.getContract(
    'HGelatoV2LimitOrder',
    deployer
  );

  await registry.register(
    hGelatoV2LimitOrder.address,
    utils.formatBytes32String('HGelatoV2LimitOrder')
  );
};

module.exports.tags = ['HGelatoV2LimitOrder'];
module.exports.dependencies = ['Registry'];
