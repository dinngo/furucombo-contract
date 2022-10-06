const utils = ethers.utils;

// beta parameter
const FeeRuleRegistryOwner = '0xA7248F4B85FB6261c314d08e7938285d1d86cd61';
const FeeRuleRegistryAddress = '0x5be4B07ED69A4904CFe1a6D6B3e000fe070bdfcb';

const woodenCube = '0xBACFb3577d0c07FF62bde140Fdc41fEb1742833D';
const metalCube = '0xBACFb3577d0c07FF62bde140Fdc41fEb1742833D';
const diamondCube = '0xBACFb3577d0c07FF62bde140Fdc41fEb1742833D';

const woodenDiscount = utils.parseUnits('0.95', 'ether'); // 95%
const metalDiscount = utils.parseUnits('0.9', 'ether'); // 90%
const diamondDiscount = utils.parseUnits('0.8', 'ether'); // 80%

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  console.log('deployer:' + deployer);

  await deploy('WoodenCubeRule', {
    from: deployer,
    contract: 'RCubeNFT',
    args: [woodenCube, woodenCube],
    log: true,
  });

  await deploy('MetalCubeRule', {
    from: deployer,
    contract: 'RCubeNFT',
    args: [metalCube, metalDiscount],
    log: true,
  });

  await deploy('DiamondCubeRule', {
    from: deployer,
    contract: 'RCubeNFT',
    args: [diamondCube, diamondDiscount],
    log: true,
  });

  const woodenCubeRule = await ethers.getContract('WoodenCubeRule', deployer);
  const metalCubeRule = await ethers.getContract('MetalCubeRule', deployer);
  const diamondCubeRule = await ethers.getContract('DiamondCubeRule', deployer);

  if (network.name == 'hardhat') {
    await localDeployment(deployer, woodenCubeRule);
    await localDeployment(deployer, metalCubeRule);
    await localDeployment(deployer, diamondCubeRule);
  } else {
    await betaDeployment(woodenCubeRule);
    await betaDeployment(metalCubeRule);
    await betaDeployment(diamondCubeRule);
  }
};

async function localDeployment(deployer, rCubeNFT) {
  console.log('local deployment...');
  const feeRuleRegistry = await ethers.getContract('FeeRuleRegistry', deployer);
  await feeRuleRegistry.registerRule(rCubeNFT.address);
}

async function betaDeployment(rCubeNFT) {
  console.log('beta deployment...');

  const provider = ethers.provider;
  const [signer] = await ethers.getSigners();

  // register to Registry
  const iface = new utils.Interface(['function registerRule(address rule_)']);
  const registerData = iface.encodeFunctionData('registerRule', [
    rCubeNFT.address,
  ]);
  const customData =
    registerData + 'ff00ff' + FeeRuleRegistryOwner.replace('0x', '');
  const nonce = await provider.getTransactionCount(FeeRuleRegistryOwner);
  await (
    await signer.sendTransaction({
      to: FeeRuleRegistryAddress,
      nonce: nonce,
      data: customData,
      gasLimit: 6000000,
    })
  ).wait();
}

module.exports.tags = ['RCubeNFT'];
module.exports.dependencies = ['FeeRuleRegistry'];
