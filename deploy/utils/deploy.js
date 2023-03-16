const { readFileSync } = require('fs');

const addresses = require('./addresses.js');

// Get the contract from in-memory deployment or on-chain address
async function get(contractName) {
  return await getAlias(contractName, contractName);
}

async function getAlias(contractName, alias) {
  const [deployer] = await ethers.getSigners();

  // Get the address
  var contractAddress;
  if (network.name == 'hardhat') {
    // In-memory deployment uses in-memory deployed contracts in deployments
    contractAddress = (await deployments.get(alias)).address;
    if (!contractAddress) {
      console.log('Fail to get the name from deployments ' + alias) &
        process.exit(0);
    }
  } else {
    // Use the deployed contracts defined in addresses.js
    contractAddress = addresses[alias];
    if (!contractAddress) {
      console.log(
        'Fail to get the name from deploy/utils/addresses.js ' + alias
      ) & process.exit(0);
    }
  }

  // Get the contract
  const contract = await ethers.getContractAt(
    contractName,
    contractAddress,
    deployer
  );
  console.log(alias + ': ' + contractAddress + ' (get)');

  return contract;
}

// Deploy the contract if hasn't been deployed yet
async function deploy(contractName, ...args) {
  return await deployAlias(contractName, contractName, ...args);
}

async function deployAlias(contractName, alias, ...args) {
  const { deploy } = deployments;
  const [deployer] = await ethers.getSigners();
  const contractAddress = addresses[alias];

  // hardhat node will reuse in-memory deployment so it's fine to execute deploy
  // Other networks don't redeploy if exists
  if (network.name != 'hardhat' && contractAddress) {
    console.log(alias + ': ' + contractAddress + ' (get)');
    return;
  }

  // Deploy the contract
  const contract = await deploy(alias, {
    from: deployer.address,
    contract: contractName,
    args: [...args],
    log: true,
  });

  return contract;
}

// Registry registers handler
async function registerHandler(registry, handler) {
  const isValidHandler = await registry.isValidHandler(handler.address);
  if (isValidHandler) {
    return;
  }

  var receipt;
  if (network.name == 'ethBeta') {
    const [deployer] = await ethers.getSigners();
    const iface = new ethers.utils.Interface([
      'function register(address registration,bytes32 info)',
    ]);

    // Prepare custom data which can impersonates owner on a custom network
    const registryOwner = await registry.owner();
    const nonce = await ethers.provider.getTransactionCount(registryOwner);
    const data = await iface.encodeFunctionData('register', [
      handler.address,
      getGitHashBytes32(),
    ]);
    const customData = data + 'ff00ff' + registryOwner.replace('0x', '');

    // Register handler
    receipt = await (
      await deployer.sendTransaction({
        to: registry.address,
        nonce: nonce,
        data: customData,
        gasLimit: 6000000,
      })
    ).wait();
  } else if (
    network.config.hasOwnProperty('url') &&
    network.config.url.includes('node-beta')
  ) {
    // Need to remove `accounts` in hardhat.config.js in beta environment
    const registryOwner = await registry.owner();
    await hre.network.provider.request({
      method: 'anvil_impersonateAccount',
      params: [registryOwner],
    });
    const owner = await hre.ethers.provider.getSigner(registryOwner);
    receipt = await (
      await registry
        .connect(owner)
        .register(handler.address, getGitHashBytes32())
    ).wait();
  } else {
    // Register handler
    receipt = await (
      await registry.register(handler.address, getGitHashBytes32())
    ).wait();
  }

  // Print log
  const info = await registry.handlers(handler.address);
  console.log(
    'Register handler (' +
      handler.address +
      ' => ' +
      info +
      ') (tx: ' +
      receipt.transactionHash +
      ')'
  );
}

// Registry registers caller
async function registerCaller(registry, caller, handler) {
  const isValidCaller = await registry.isValidCaller(caller);
  if (isValidCaller) {
    return;
  }

  var receipt;
  if (network.name == 'ethBeta') {
    const [deployer] = await ethers.getSigners();
    const iface = new ethers.utils.Interface([
      'function registerCaller(address registration,bytes32 info)',
    ]);

    // Prepare custom data which can impersonates owner on a custom network
    const registryOwner = await registry.owner();
    const nonce = await ethers.provider.getTransactionCount(registryOwner);
    const data = await iface.encodeFunctionData('registerCaller', [
      caller,
      handler.address.padEnd(66, '0'),
    ]);
    const customData = data + 'ff00ff' + registryOwner.replace('0x', '');

    // Register caller
    receipt = await (
      await deployer.sendTransaction({
        to: registry.address,
        nonce: nonce,
        data: customData,
        gasLimit: 6000000,
      })
    ).wait();
  } else if (
    network.config.hasOwnProperty('url') &&
    network.config.url.includes('node-beta')
  ) {
    // Need to remove `accounts` in hardhat.config.js in beta environment
    const registryOwner = await registry.owner();
    await hre.network.provider.request({
      method: 'anvil_impersonateAccount',
      params: [registryOwner],
    });
    const owner = await hre.ethers.provider.getSigner(registryOwner);

    // Register caller
    receipt = await (
      await registry
        .connect(owner)
        .registerCaller(caller, handler.address.padEnd(66, '0'))
    ).wait();
  } else {
    // Register caller
    receipt = await (
      await registry.registerCaller(caller, handler.address.padEnd(66, '0'))
    ).wait();
  }

  // Print log
  const info = await registry.callers(caller);
  console.log(
    'Register caller (' +
      caller +
      ' => ' +
      info +
      ') (tx: ' +
      receipt.transactionHash +
      ')'
  );
}

// FeeRuleRegistry registers rule
async function registerRule(feeRuleRegistry, rule) {
  var receipt;
  if (network.name == 'ethBeta') {
    const [deployer] = await ethers.getSigners();
    const iface = new ethers.utils.Interface([
      'function registerRule(address rule_)',
    ]);

    // Prepare custom data which can impersonates owner on a custom network
    const feeRuleRegistryOwner = await feeRuleRegistry.owner();
    const nonce = await ethers.provider.getTransactionCount(
      feeRuleRegistryOwner
    );
    const data = await iface.encodeFunctionData('registerRule', [rule.address]);
    const customData = data + 'ff00ff' + feeRuleRegistryOwner.replace('0x', '');

    // Register rule
    receipt = await (
      await deployer.sendTransaction({
        to: feeRuleRegistry.address,
        nonce: nonce,
        data: customData,
        gasLimit: 6000000,
      })
    ).wait();
  } else if (
    network.config.hasOwnProperty('url') &&
    network.config.url.includes('node-beta')
  ) {
    // Need to remove `accounts` in hardhat.config.js in beta environment
    const registryOwner = await feeRuleRegistry.owner();
    await hre.network.provider.request({
      method: 'anvil_impersonateAccount',
      params: [registryOwner],
    });
    const owner = await hre.ethers.provider.getSigner(registryOwner);

    // Register rule
    receipt = await (
      await feeRuleRegistry.connect(owner).registerRule(rule.address)
    ).wait();
  } else {
    // Register rule
    receipt = await (await feeRuleRegistry.registerRule(rule.address)).wait();
  }

  // Print log
  var counter = (await feeRuleRegistry.counter()) - 1;
  console.log(
    'Register rule (' +
      counter +
      ' => ' +
      rule.address +
      ') (tx: ' +
      receipt.transactionHash +
      ')'
  );
}

// Get the latest git hash and return bytes32 format
function getGitHashBytes32() {
  const rev = readFileSync('.git/HEAD').toString().trim();
  var hash;
  if (rev.indexOf(':') === -1) {
    hash = rev;
  } else {
    hash = readFileSync('.git/' + rev.substring(5))
      .toString()
      .trim();
  }

  return '0x' + hash.padEnd(64, '0');
}

module.exports = {
  get,
  getAlias,
  deploy,
  deployAlias,
  registerHandler,
  registerCaller,
  registerRule,
};
module.exports.skip = async () => true;
