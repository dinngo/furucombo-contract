const CUBE = '0xBACFb3577d0c07FF62bde140Fdc41fEb1742833D';
const DISCOUNT = ethers.utils.parseUnits('0.95', 'ether'); // 95%

const utils = ethers.utils;

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  await deploy('RCubeNFT', {
    from: deployer,
    args: [CUBE, DISCOUNT],
    log: true,
  });

  const feeRuleRegistry = await ethers.getContract('FeeRuleRegistry', deployer);
  const rCubeNFT = await ethers.getContract('RCubeNFT', deployer);
  await feeRuleRegistry.registerRule(rCubeNFT.address);
};

module.exports.tags = ['RCubeNFT'];
module.exports.dependencies = ['FeeRuleRegistry'];
