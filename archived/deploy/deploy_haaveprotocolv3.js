const AAVE_POOL_V3 = '0x794a61358D6845594F94dc1DB02A252b5b4814aD';
const utils = ethers.utils;

// beta parameter (fee version)
const registryOwner = '0xbE8F6FeFe32F18ea5fBdb51c76EFFC5481a45e00';
const registryAddress = '0x78B95131bC21eC73DF5158CF7A018Ad7bADa5561';

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  await deploy('HAaveProtocolV3', {
    from: deployer,
    args: [],
    log: true,
  });

  const hAaveProtocolV3 = await ethers.getContract('HAaveProtocolV3', deployer);

  if (network.name == 'hardhat') {
    await localDeployment(deployer, hAaveProtocolV3);
  } else {
    await betaDeployment(hAaveProtocolV3);
  }
};

async function localDeployment(deployer, hAaveProtocolV3) {
  console.log('local deployment...');
  const registry = await ethers.getContract('Registry', deployer);

  await registry.register(
    hAaveProtocolV3.address,
    utils.formatBytes32String('HAaveProtocolV3')
  );

  await registry.registerCaller(
    AAVE_POOL_V3,
    utils.hexConcat([hAaveProtocolV3.address, '0x000000000000000000000000'])
  );
}

async function betaDeployment(hAaveProtocolV3) {
  console.log('beta deployment...');

  const provider = ethers.provider;
  const [signer] = await ethers.getSigners();

  // register to Registry
  const registerInterface = new utils.Interface([
    'function register(address registration,bytes32 info)',
  ]);

  const registerData = registerInterface.encodeFunctionData('register', [
    hAaveProtocolV3.address,
    utils.formatBytes32String('HAaveProtocolV3'),
  ]);

  const registerCustomData =
    registerData + 'ff00ff' + registryOwner.replace('0x', '');

  const nonce = await provider.getTransactionCount(registryOwner);

  await signer.sendTransaction({
    to: registryAddress,
    nonce: nonce,
    data: registerCustomData,
    gasLimit: 6000000,
  });

  // registerCaller to Registry
  const registerCallerInterface = new utils.Interface([
    'function registerCaller(address registration,bytes32 info)',
  ]);

  const registerCallerData = registerCallerInterface.encodeFunctionData(
    'registerCaller',
    [
      AAVE_POOL_V3,
      utils.hexConcat([hAaveProtocolV3.address, '0x000000000000000000000000']),
    ]
  );

  const registerCallerDataCustomData =
    registerCallerData + 'ff00ff' + registryOwner.replace('0x', '');

  await signer.sendTransaction({
    to: registryAddress,
    nonce: nonce + 1,
    data: registerCallerDataCustomData,
    gasLimit: 6000000,
  });
}

module.exports.tags = ['HAaveProtocolV3'];
module.exports.dependencies = ['Registry'];
