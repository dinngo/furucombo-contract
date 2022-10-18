const utils = ethers.utils;
const chainId = network.config.chainId;

// ethereum beta parameter
const FeeRuleRegistryOwner = '0xA7248F4B85FB6261c314d08e7938285d1d86cd61';
const FeeRuleRegistryAddress = '0x5be4B07ED69A4904CFe1a6D6B3e000fe070bdfcb';

// cube NFT parameter
const woodenCube = '0xBACFb3577d0c07FF62bde140Fdc41fEb1742833D';
const metalCube = '0x3C4c876B91B6d05a8CDD9482804972D53d17EE14';
const diamondCube = '0xE91A1a5441F5Fc4Da600E2DBa36D52B53365C045';
const woodenDiscount = utils.parseUnits('0.95', 'ether'); // 95%
const metalDiscount = utils.parseUnits('0.9', 'ether'); // 90%
const diamondDiscount = utils.parseUnits('0.8', 'ether'); // 80%

// free pass parameter
const freePassDiscount = utils.parseUnits('0', 'ether'); // 0%
const ArbitrumFreePass = '0x87C277Fa828b69Bd62d642Ba310448Cd9C12dfF4';
const OptimismFreePass = '0xb77e3232895E689b54Ae3587ED4F8357F0aefA93';

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  console.log('deployer:' + deployer);

  if (network.name == 'hardhat') {
    console.log('chainId', chainId);
    if (chainId == 1) {
      const woodenCubeRule = await deployRCubeNFT(
        deploy,
        deployer,
        'WoodenCubeRule',
        woodenDiscount,
        woodenCube
      );
      const metalCubeRule = await deployRCubeNFT(
        deploy,
        deployer,
        'MetalCubeRule',
        metalDiscount,
        metalCube
      );
      const diamondCubeRule = await deployRCubeNFT(
        deploy,
        deployer,
        'DiamondCubeRule',
        diamondDiscount,
        diamondCube
      );

      // register rules
      await localDeployment(deployer, woodenCubeRule);
      await localDeployment(deployer, metalCubeRule);
      await localDeployment(deployer, diamondCubeRule);
    } else if (chainId == 42161) {
      const freePassRule = await deployRCubeNFT(
        deploy,
        deployer,
        'FreePassRule',
        freePassDiscount,
        ArbitrumFreePass
      );

      // register rules
      await localDeployment(deployer, freePassRule);
    } else if (chainId == 10) {
      const freePassRule = await deployRCubeNFT(
        deploy,
        deployer,
        'FreePassRule',
        freePassDiscount,
        OptimismFreePass
      );

      // register rules
      await localDeployment(deployer, freePassRule);
    }
  } else if (network.name == 'ethBeta') {
    const woodenCubeRule = await deployRCubeNFT(
      deploy,
      deployer,
      'WoodenCubeRule',
      woodenDiscount,
      woodenCube
    );
    const metalCubeRule = await deployRCubeNFT(
      deploy,
      deployer,
      'MetalCubeRule',
      metalDiscount,
      metalCube
    );
    const diamondCubeRule = await deployRCubeNFT(
      deploy,
      deployer,
      'DiamondCubeRule',
      diamondDiscount,
      diamondCube
    );

    // register rules
    await betaDeployment(woodenCubeRule);
    await betaDeployment(metalCubeRule);
    await betaDeployment(diamondCubeRule);
  }
};

async function localDeployment(deployer, rCubeNFT) {
  const feeRuleRegistry = await ethers.getContract('FeeRuleRegistry', deployer);
  await feeRuleRegistry.registerRule(rCubeNFT.address);
}

async function betaDeployment(rCubeNFT) {
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

async function deployRCubeNFT(deploy, deployer, ruleName, discount, nft) {
  await deploy(ruleName, {
    from: deployer,
    contract: 'RCubeNFT',
    args: [nft, discount],
    log: true,
  });
  return await ethers.getContract(ruleName, deployer);
}
module.exports.tags = ['RCubeNFT'];
module.exports.dependencies = ['FeeRuleRegistry'];
